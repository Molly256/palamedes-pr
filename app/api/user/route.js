import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic';

const VIP_CONFIG = {
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
  if (!phone) return ''
  phone = String(phone).replace(/\D/g, '')
  
  if (phone.startsWith('256') && phone.length === 12) {
    phone = '0' + phone.slice(3)
  }

  if (!/^07\d{8}$/.test(phone)) {
    return ''
  }
  return phone
}

function getISOTimestamp() {
  return new Date().toISOString()
}

function isWithdrawOpen() {
  const now = new Date()
  const ugandaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Kampala' }))

  const day = ugandaTime.getDay()
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

async function syncBalanceFields(phone, amount) {
  const userKey = `user:${phone}`
  const amountStr = String(amount)
  await kv.hset(userKey, {
    balance: amountStr,
    available_balance: amountStr
  })
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

    if (!phone) {
      const authHeader = request.headers.get('authorization')
      if (authHeader?.startsWith('Bearer ')) {
        phone = authHeader.replace('Bearer ', '')
      }
    }

    phone = normalizePhone(phone)

    if (!phone && action!== 'register') {
      return NextResponse.json({ success: false, message: 'Phone must be 10 digits starting with 07' }, { status: 400 })
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
        balance: '0',
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

      const balance = Number(user.balance || user.available_balance || 0)

      return NextResponse.json({
        success: true,
        user: {
          username: user.username || '',
          phone: user.phone || phone,
          balance: balance,
          available_balance: balance,
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

    const balance = Number(user.balance || user.available_balance || 0)
    return NextResponse.json({
      success: true,
      user: {
        username: user.username || '',
        phone: user.phone || phone,
        balance: balance,
        available_balance: balance,
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
    let { action, phone, field, value, oldPass, newPass, number, method, names, amount, txId, adminPhone } = body

    phone = normalizePhone(phone)
    adminPhone = normalizePhone(adminPhone)

    if (!phone) return NextResponse.json({ success: false, message: 'Phone must be 10 digits starting with 07' }, { status: 400 })

    const { user, userKey } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    if (action === 'deposit') {
      const depositAmount = Number(value)
      if (!depositAmount || depositAmount <= 0) {
        return NextResponse.json({ success: false, message: 'Invalid deposit amount' }, { status: 400 })
      }

      const txId = `dep_${Date.now()}`
      const tx = {
        id: txId,
        type: 'deposit',
        amount: depositAmount,
        method: method || '',
        date: getISOTimestamp(),
        status: 'pending',
        desc: `Deposit via ${method || 'Mobile Money'}`,
        phone: phone,
        userPhone: phone
      }

      await pushTransaction(phone, tx)
      await kv.lpush(`admin:deposits:pending:0753520252`, JSON.stringify(tx))

      return NextResponse.json({
        success: true,
        tx,
        message: 'Deposit request submitted. Pending admin approval.'
      })
    }

    if (action === 'confirmDeposit') {
      if (adminPhone!== '0753520252') {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
      }

      if (!txId) {
        return NextResponse.json({ success: false, message: 'Transaction ID required' }, { status: 400 })
      }

      const pendingKey = `admin:deposits:pending:0753520252`
      const pendingDeposits = await kv.lrange(pendingKey, 0, -1)
      const tx = pendingDeposits.map(t => safeParse(t)).find(t => t?.id === txId)

      if (!tx) {
        return NextResponse.json({ success: false, message: 'Deposit not found' }, { status: 404 })
      }

      const targetPhone = tx.userPhone
      const { user: targetUser, userKey: targetKey } = await getUserData(targetPhone)
      if (!targetUser) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
      }

      const newBalance = (Number(targetUser.balance) || 0) + Number(tx.amount)
      await syncBalanceFields(targetPhone, newBalance)

      const updatedTx = {...tx, status: 'success' }

      await kv.lrem(pendingKey, 0, JSON.stringify(tx))
      await kv.lpush(`admin:deposits:approved:0753520252`, JSON.stringify(updatedTx))

      const userTxs = await kv.lrange(`transactions:${targetPhone}`, 0, -1)
      const txIndex = userTxs.findIndex(t => {
        const parsed = safeParse(t)
        return parsed?.id === txId
      })
      if (txIndex >= 0) {
        await kv.lset(`transactions:${targetPhone}`, txIndex, JSON.stringify(updatedTx))
      }

      return NextResponse.json({ success: true, message: 'Deposit confirmed', newBalance })
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
      const balance = Number(user.balance || user.available_balance || 0)

      if (!amount || amount <= 0) {
        return NextResponse.json({ success: false, message: 'Invalid withdraw amount' }, { status: 400 })
      }
      if (amount > balance) {
        return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 })
      }
      if (!number ||!names) {
        return NextResponse.json({ success: false, message: 'Phone number and names required' }, { status: 400 })
      }

      const withdrawalPhone = normalizePhone(number)
      if (!withdrawalPhone) {
        return NextResponse.json({ success: false, message: 'Withdrawal phone must be 10 digits starting with 07' }, { status: 400 })
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
        number: withdrawalPhone,
        names: names,
        date: getISOTimestamp(),
        status: 'pending',
        desc: `Withdraw to ${method} - ${withdrawalPhone} - ${names}`,
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
      if (vipLevel < 1) return NextResponse.json({ success: false, message: 'Cannot buy VIP 0' }, { status: 400 })

      const newPrice = Number(config.price)
      const balance = Number(user.balance || user.available_balance || 0)

      if (vipLevel <= currentVip) {
        return NextResponse.json({ success: false, message: 'Cannot downgrade VIP' }, { status: 400 })
      }
      
      const upgradeCost = newPrice - currentPricePaid
      if (balance < upgradeCost) {
        return NextResponse.json({ success: false, message: `Insufficient balance. Need ${upgradeCost}shs more` }, { status: 400 })
      }

      const newBalance = balance - upgradeCost

      await kv.hset(userKey, {
        balance: String(newBalance),
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
          const { user: upline1 } = await getUserData(user.upline1)
          if (upline1) {
            const rewardA = Math.floor(paidPrice * 0.05)
            if (rewardA > 0) {
              await syncBalanceFields(user.upline1, Number(upline1.balance || 0) + rewardA)
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
          const { user: upline2 } = await getUserData(user.upline2)
          if (upline2) {
            const rewardB = Math.floor(paidPrice * 0.02)
            if (rewardB > 0) {
              await syncBalanceFields(user.upline2, Number(upline2.balance || 0) + rewardB)
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
          const { user: upline3 } = await getUserData(user.upline3)
          if (upline3) {
            const rewardC = Math.floor(paidPrice * 0.01)
            if (rewardC > 0) {
              await syncBalanceFields(user.upline3, Number(upline3.balance || 0) + rewardC)
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
      const finalBalance = Number(freshUser?.balance || freshUser?.available_balance || 0)

      return NextResponse.json({
        success: true,
        user: {
          username: freshUser?.username || '',
          phone: freshUser?.phone || phone,
          balance: finalBalance,
          available_balance: finalBalance,
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
        message: `VIP${vipLevel} activated! Paid ${upgradeCost}shs`
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