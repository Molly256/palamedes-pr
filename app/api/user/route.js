import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

const VIP_CONFIG = {
 0: { price: 0, books: 4, perBook: 625 },
 1: { price: 80000, books: 4, perBook: 625 },
 2: { price: 250000, books: 4, perBook: 2000 },
 3: { price: 790000, books: 4, perBook: 6500 },
 4: { price: 1000000, books: 5, perBook: 7000 },
 5: { price: 1500000, books: 5, perBook: 10000 },
 6: { price: 2100000, books: 5, perBook: 14000 },
 7: { price: 4000000, books: 5, perBook: 28000 },
 8: { price: 4600000, books: 5, perBook: 32000 },
 9: { price: 5000000, books: 5, perBook: 40000 },
 10: { price: 8000000, books: 5, perBook: 60000 },
}

function safeParse(val) {
  if (!val || val === '' || val === 'null' || val === 'undefined') return null
  if (typeof val === 'object') return val
  try {
    let parsed = val
    for (let i = 0; i < 2; i++) {
      if (typeof parsed === 'string') parsed = JSON.parse(parsed)
      else break
    }
    return parsed
  } catch { return null }
}

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')
  if (phone.length === 9 &&!phone.startsWith('0')) phone = '0' + phone
  return phone
}

function getISOTimestamp() {
  return new Date().toISOString()
}

function isWithdrawOpen() {
  const now = new Date()
  const ugandaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Kampala' }))

  const day = ugandaTime.getDay() // 0=Sunday, 1=Monday...6=Saturday
  const hour = ugandaTime.getHours()
  const minute = ugandaTime.getMinutes()

  const isWeekday = day >= 1 && day <= 5
  const isOpenTime = (hour > 10 || (hour === 10 && minute >= 0)) && (hour < 17 || (hour === 17 && minute === 0))

  return { open: isWeekday && isOpenTime, day, hour, minute }
}

async function getUserData(phone) {
  const userKey = `user:${phone}`
  if ((await kv.type(userKey)) === 'hash') {
    const user = await kv.hgetall(userKey)
    return { user, userKey }
  }
  return { user: null, userKey: null }
}

async function getTransactions(phone) {
  const key = `transactions:${phone}`
  const type = await kv.type(key)
  if (type!== 'list') return []
  const raw = await kv.lrange(key, 0, 99)
  return raw.map(t => safeParse(t)).filter(Boolean)
}

async function pushTransaction(phone, tx) {
  await kv.lpush(`transactions:${phone}`, JSON.stringify(tx))
}

async function buildTeams(phone) {
  const keys = await kv.keys('user:*')
  const allUsers = []

  for (let key of keys) {
    if ((await kv.type(key))!== 'hash') continue
    const u = await kv.hgetall(key)
    if (!u) continue
    allUsers.push({...u, phone: key.split(':')[1] })
  }

  const teamA = allUsers.filter(u => normalizePhone(u.upline1) === phone)
  const teamAPhones = new Set(teamA.map(u => u.phone))

  const teamB = allUsers.filter(u => teamAPhones.has(normalizePhone(u.upline1)))
  const teamBPhones = new Set(teamB.map(u => u.phone))

  const teamC = allUsers.filter(u => teamBPhones.has(normalizePhone(u.upline1)))

  return { teamA, teamB, teamC }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    let phone = searchParams.get('phone')
    const action = searchParams.get('action')

    phone = normalizePhone(phone)

    if (!phone && action!== 'register') {
      return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    if (action === 'register') {
      const { username, password, inviteCode } = Object.fromEntries(searchParams)

      if (!username ||!password) {
        return NextResponse.json({ success: false, message: 'Username and password required' }, { status: 400 })
      }

      const { user: existingUser } = await getUserData(phone)
      if (existingUser) {
        return NextResponse.json({ success: false, message: 'User already exists' }, { status: 400 })
      }

      let upline1 = ''
      if (inviteCode) {
        const inviterPhone = normalizePhone(inviteCode.replace('PM', ''))
        const { user: inviter } = await getUserData(inviterPhone)
        if (inviter) upline1 = inviterPhone
      }

      const userKey = `user:${phone}`
      await kv.hset(userKey, {
        phone,
        username,
        password,
        upline1,
        upline2: '',
        upline3: '',
        referralPaid: 'false',
        vip: '0',
        available_balance: '0',
        vipPricePaid: '0',
        tasksCompleted: '0',
        vipLocked: 'false',
        hasBoughtVIP: 'false',
        createdAt: getISOTimestamp()
      })

      return NextResponse.json({ success: true, message: 'User registered' })
    }

    const { user } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    if (action === 'getTransactions') {
      const transactions = await getTransactions(phone)
      const type = searchParams.get('type') || 'all'

      let filtered = transactions
      if (type!== 'all') {
        filtered = transactions.filter(t => t.type === type)
      }

      return NextResponse.json({ success: true, transactions: filtered })
    }

    if (action === 'getDashboard') {
      const transactions = await getTransactions(phone)
      const recentTx = transactions.slice(0, 49)
      const vipTx = transactions.find(t => t.type === 'viptask_purchase')
      const vipPurchaseDate = vipTx? vipTx.date : null

      const { teamA, teamB, teamC } = await buildTeams(phone)

      const totalEarnings = transactions
     .filter(t => t.type === 'referral_reward' && t.status === 'success')
     .reduce((sum, t) => sum + Number(t.amount || 0), 0)

      return NextResponse.json({
        success: true,
        user: {
          username: user.username || '',
          phone: user.phone || phone,
          available_balance: Number(user.available_balance) || 0,
          vip: Number(user.vip) || 0,
          avatar: user.avatar || '',
          nickname: user.nickname || '',
          vipLocked: user.vipLocked === 'true',
          hasBoughtVIP: user.hasBoughtVIP === 'true',
          tasksCompleted: Number(user.tasksCompleted) || 0,
          vipPricePaid: Number(user.vipPricePaid) || 0,
          bankMTN: safeParse(user.bankMTN),
          bankAirtel: safeParse(user.bankAirtel),
          password: user.password || '',
          referralPaid: user.referralPaid || 'false',
          vip_commission_paid: user.vip_commission_paid || 'false',
          upline1: user.upline1 || '',
          upline2: user.upline2 || '',
          upline3: user.upline3 || '',
          createdAt: user.createdAt || ''
        },
        transactions: recentTx,
        vipPurchaseDate,
        stats: {
          teamA: teamA.length,
          teamB: teamB.length,
          teamC: teamC.length,
          totalMembers: teamA.length + teamB.length + teamC.length,
          totalEarnings
        }
      })
    }

    return NextResponse.json({
      success: true,
      user: {
        username: user.username || '',
        phone: user.phone || phone,
        available_balance: Number(user.available_balance) || 0,
        vip: Number(user.vip) || 0,
        nickname: user.nickname || '',
        avatar: user.avatar || '',
        bankMTN: safeParse(user.bankMTN),
        bankAirtel: safeParse(user.bankAirtel),
        password: user.password || '',
        vipLocked: user.vipLocked === 'true',
        hasBoughtVIP: user.hasBoughtVIP === 'true',
        tasksCompleted: Number(user.tasksCompleted) || 0,
        vipPricePaid: Number(user.vipPricePaid) || 0,
        referralPaid: user.referralPaid || 'false',
        vip_commission_paid: user.vip_commission_paid || 'false',
        upline1: user.upline1 || '',
        upline2: user.upline2 || '',
        upline3: user.upline3 || '',
        createdAt: user.createdAt || ''
      }
    })
  } catch (err) {
    console.error('GET /api/user error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    let { action, phone, field, value, oldPass, newPass, number, method, names, amount } = body

    phone = normalizePhone(phone)

    if (!phone) return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })

    const { user, userKey } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    if (action === 'deposit') {
      const amount = Number(value)
      if (!amount || amount <= 0) {
        return NextResponse.json({ success: false, message: 'Invalid deposit amount' }, { status: 400 })
      }

      const tx = {
        id: Date.now(),
        type: 'deposit',
        amount: amount,
        method: method || '',
        date: getISOTimestamp(),
        status: 'pending',
        desc: `Deposit via ${method || 'Mobile Money'}`,
        phone: phone
      }

      await pushTransaction(phone, tx)
      return NextResponse.json({ success: true, tx, message: 'Deposit request submitted. Pending approval.' })
    }

    if (action === 'withdraw') {
      const { open } = isWithdrawOpen()
      if (!open) {
        return NextResponse.json({
          success: false,
          message: 'Withdrawals are only available Monday to Friday, 10:00 AM - 5:00 PM EAT'
        }, { status: 403 })
      }

      const amount = Number(value)
      const balance = Number(user.available_balance) || 0

      if (!amount || amount <= 0) {
        return NextResponse.json({ success: false, message: 'Invalid withdraw amount' }, { status: 400 })
      }
      if (amount > balance) {
        return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 })
      }
      if (!number ||!names) {
        return NextResponse.json({ success: false, message: 'Phone number and names required' }, { status: 400 })
      }

      const fee = Math.floor(amount * 0.1)
      const netAmount = amount - fee

      const tx = {
        id: Date.now(),
        type: 'withdraw',
        amount: -amount,
        netAmount: netAmount,
        fee: fee,
        method: method || '',
        number: number,
        names: names,
        date: getISOTimestamp(),
        status: 'pending',
        desc: `Withdraw to ${method} - ${number} - ${names}`,
        phone: phone
      }

      await pushTransaction(phone, tx)
      return NextResponse.json({ success: true, tx, message: 'Withdraw request submitted. Pending approval.' })
    }

    if (action === 'buyvip') {
      const currentVip = Number(user.vip) || 0
      const currentPricePaid = Number(user.vipPricePaid) || 0
      const vipLevel = Number(body.vipLevel)
      const config = VIP_CONFIG[vipLevel]

      if (!config) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

      const newPrice = Number(config.price)
      const balance = Number(user.available_balance) || 0

      if (!vipLevel || vipLevel <= currentVip) {
        return NextResponse.json({ success: false, message: 'Cannot downgrade VIP' }, { status: 400 })
      }
      if (balance < newPrice) {
        return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 })
      }

      let newBalance = balance - newPrice
      if (currentPricePaid > 0) newBalance += currentPricePaid

      await kv.hset(userKey, {
        available_balance: String(newBalance),
        vip: String(vipLevel),
        vipPricePaid: String(newPrice),
        vipLocked: 'false',
        tasksCompleted: '0',
        hasBoughtVIP: 'true'
      })

      const timestamp = getISOTimestamp()

      if (currentPricePaid > 0) {
        await pushTransaction(phone, {
          id: Date.now(),
          type: 'refund',
          amount: currentPricePaid,
          date: timestamp,
          status: 'success',
          desc: `Refund VIP${currentVip} on upgrade to VIP${vipLevel}`,
          phone: phone
        })
      }

      await pushTransaction(phone, {
        id: Date.now() + 1,
        type: 'viptask_purchase',
        amount: -newPrice,
        date: timestamp,
        status: 'success',
        desc: `Bought VIP${vipLevel}`,
        phone: phone
      })

      if (currentVip === 0 && user.referralPaid!== 'true') {
        const paidPrice = Number(config.price)
        const paidUplines = new Set()

        if (user.upline1 && user.upline1!== phone &&!paidUplines.has(user.upline1)) {
          const { user: upline1, userKey: upline1Key } = await getUserData(user.upline1)
          if (upline1) {
            const rewardA = Math.floor(paidPrice * 0.05)
            if (rewardA > 0) {
              await kv.hset(upline1Key, { available_balance: String(Number(upline1.available_balance || 0) + rewardA) })
              await pushTransaction(user.upline1, {
                id: Date.now() + 2,
                type: 'referral_reward',
                amount: rewardA,
                date: timestamp,
                status: 'success',
                desc: `Team A reward from ${user.username || phone} buying VIP${vipLevel}`,
                phone: user.upline1
              })
              paidUplines.add(user.upline1)
            }
          }
        }

        if (user.upline2 && user.upline2!== user.upline1 && user.upline2!== phone &&!paidUplines.has(user.upline2)) {
          const { user: upline2, userKey: upline2Key } = await getUserData(user.upline2)
          if (upline2) {
            const rewardB = Math.floor(paidPrice * 0.02)
            if (rewardB > 0) {
              await kv.hset(upline2Key, { available_balance: String(Number(upline2.available_balance || 0) + rewardB) })
              await pushTransaction(user.upline2, {
                id: Date.now() + 3,
                type: 'referral_reward',
                amount: rewardB,
                date: timestamp,
                status: 'success',
                desc: `Team B reward from ${user.username || phone} buying VIP${vipLevel}`,
                phone: user.upline2
              })
              paidUplines.add(user.upline2)
            }
          }
        }

        if (user.upline3 && user.upline3!== user.upline2 && user.upline3!== user.upline1 && user.upline3!== phone &&!paidUplines.has(user.upline3)) {
          const { user: upline3, userKey: upline3Key } = await getUserData(user.upline3)
          if (upline3) {
            const rewardC = Math.floor(paidPrice * 0.01)
            if (rewardC > 0) {
              await kv.hset(upline3Key, { available_balance: String(Number(upline3.available_balance || 0) + rewardC) })
              await pushTransaction(user.upline3, {
                id: Date.now() + 4,
                type: 'referral_reward',
                amount: rewardC,
                date: timestamp,
                status: 'success',
                desc: `Team C reward from ${user.username || phone} buying VIP${vipLevel}`,
                phone: user.upline3
              })
              paidUplines.add(user.upline3)
            }
          }
        }

        await kv.hset(userKey, { referralPaid: 'true' })
      }

      let freshUser = await kv.hgetall(userKey)

      return NextResponse.json({
        success: true,
        user: {
          username: freshUser?.username || '',
          phone: freshUser?.phone || phone,
          available_balance: Number(freshUser?.available_balance) || 0,
          vip: Number(freshUser?.vip) || 0,
          vipPricePaid: Number(freshUser?.vipPricePaid) || 0,
          vipLocked: freshUser?.vipLocked === 'true',
          hasBoughtVIP: freshUser?.hasBoughtVIP === 'true',
          tasksCompleted: Number(freshUser?.tasksCompleted) || 0,
          nickname: freshUser?.nickname || '',
          avatar: freshUser?.avatar || '',
          bankMTN: safeParse(freshUser?.bankMTN),
          bankAirtel: safeParse(freshUser?.bankAirtel),
          password: freshUser?.password || '',
          referralPaid: freshUser?.referralPaid || 'false',
          vip_commission_paid: freshUser?.vip_commission_paid || 'false',
          upline1: freshUser?.upline1 || '',
          upline2: freshUser?.upline2 || '',
          upline3: freshUser?.upline3 || '',
          createdAt: freshUser?.createdAt || ''
        },
        message: `VIP${vipLevel} activated! Deducted ${newPrice}shs, refunded ${currentPricePaid}shs`
      })
    }

    if (action === 'updateProfile') {
      if (field === 'nickname') {
        if (value.length > 6) return NextResponse.json({ success: false, message: 'Nickname max 6 letters' }, { status: 400 })
        await kv.hset(userKey, { nickname: value })
        return NextResponse.json({ success: true, message: 'Nickname saved' })
      }
      if (field === 'bankMTN') {
        await kv.hset(userKey, { bankMTN: JSON.stringify(value) })
        return NextResponse.json({ success: true, message: 'MTN bank saved' })
      }
      if (field === 'bankAirtel') {
        await kv.hset(userKey, { bankAirtel: JSON.stringify(value) })
        return NextResponse.json({ success: true, message: 'Airtel bank saved' })
      }
      if (field === 'avatar') {
        await kv.hset(userKey, { avatar: value })
        return NextResponse.json({ success: true, message: 'Avatar updated' })
      }
    }

    if (action === 'changePassword') {
      if (String(user.password)!== String(oldPass)) {
        return NextResponse.json({ success: false, message: 'Old password incorrect' }, { status: 400 })
      }
      if (newPass.length < 6) {
        return NextResponse.json({ success: false, message: 'New password must be at least 6 characters' }, { status: 400 })
      }
      await kv.hset(userKey, { password: newPass })
      return NextResponse.json({ success: true, message: 'Password changed' })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err){
    console.error('POST /api/user error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}