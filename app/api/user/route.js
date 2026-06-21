import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
const redis = Redis.fromEnv()

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

const REWARD_TABLE = {
 1: { A: 0.05, B: 0.02, C: 0.01 },
 2: { A: 0.05, B: 0.02, C: 0.01 },
 3: { A: 0.05, B: 0.02, C: 0.01 },
 4: { A: 0.05, B: 0.02, C: 0.01 },
 5: { A: 0.05, B: 0.02, C: 0.01 },
 6: { A: 0.05, B: 0.02, C: 0.01 },
 7: { A: 0.05, B: 0.02, C: 0.01 },
 8: { A: 0.05, B: 0.02, C: 0.01 },
 9: { A: 0.05, B: 0.02, C: 0.01 },
 10: { A: 0.05, B: 0.02, C: 0.01 }
}

const ADMIN_PHONE = '0753520252'

function normalizePhone(phone) {
  if (!phone) return null
  phone = String(phone).replace(/\D/g, '')
  if (phone.startsWith('256') && phone.length === 12) {
    phone = '0' + phone.slice(3)
  }
  if (!/^07\d{8}$/.test(phone)) return null
  return phone
}

function getISOTimestamp() {
  return new Date().toISOString()
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

function isWithdrawOpen() {
  const now = new Date()
  const ugandaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Kampala' }))
  const day = ugandaTime.getDay()
  const hour = ugandaTime.getHours()
  const minute = ugandaTime.getMinutes()
  const isWeekday = day >= 1 && day <= 5
  const isOpenTime = (hour > 10 || (hour === 10 && minute >= 0)) && (hour < 17 || (hour === 17 && minute === 0))
  return { open: isWeekday && isOpenTime }
}

async function getUserData(phone) {
  if (!phone) return { user: null }
  const user = await redis.hgetall(`user:${phone}`)
  return { user: user && Object.keys(user).length > 0? user : null }
}

async function addBalance(phone, amount) {
  if (!phone) return
  const user = await redis.hgetall(`user:${phone}`)
  const current = Number(user.balance || 0)
  const newBal = current + Number(amount)
  await redis.hset(`user:${phone}`, { balance: newBal, available_balance: newBal })
}

async function getTransactions(phone) {
  if (!phone) return []
  const txList = await redis.lrange(`tx:${phone}`, 0, 999)
  return txList.map(t => {
    try {
      return JSON.parse(t)
    } catch {
      return null
    }
  }).filter(Boolean)
}

async function pushTransaction(phone, tx) {
  if (!phone) return
  await redis.lpush(`tx:${phone}`, JSON.stringify(tx))
  await redis.ltrim(`tx:${phone}`, 0, 999)
}

async function buildTeams(phone) {
  if (!phone) return { teamA: [], teamB: [], teamC: [] }

  const teamAPhones = await redis.smembers(`downlines:${phone}:1`)
  const teamBPhones = new Set()
  for (const p of teamAPhones) {
    const phones = await redis.smembers(`downlines:${p}:1`)
    phones.forEach(x => teamBPhones.add(x))
  }
  const teamCPhones = new Set()
  for (const p of teamBPhones) {
    const phones = await redis.smembers(`downlines:${p}:1`)
    phones.forEach(x => teamCPhones.add(x))
  }

  const [teamA, teamB, teamC] = await Promise.all([
    Promise.all([...teamAPhones].map(p => redis.hgetall(`user:${p}`))),
    Promise.all([...teamBPhones].map(p => redis.hgetall(`user:${p}`))),
    Promise.all([...teamCPhones].map(p => redis.hgetall(`user:${p}`)))
  ])

  return {
    teamA: teamA.filter(u => u && Object.keys(u).length > 0),
    teamB: teamB.filter(u => u && Object.keys(u).length > 0),
    teamC: teamC.filter(u => u && Object.keys(u).length > 0)
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    let phone = searchParams.get('phone')
    const action = searchParams.get('action')

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

      let upline1 = null
      let upline2 = null
      let upline3 = null
      if (inviteCode) {
        const inviterPhone = normalizePhone(inviteCode.replace('PM', ''))
        const { user: inviter } = await getUserData(inviterPhone)
        if (inviter) {
          upline1 = inviterPhone
          upline2 = inviter.upline1 || null
          upline3 = inviter.upline2 || null
        }
      }

      const userData = {
        phone, username, password, upline1, upline2, upline3,
        referral_paid: 'false', vip: 0, balance: 2500, available_balance: 2500,
        vip_price_paid: 0, first_vip_amount: 0, tasks_completed: 0,
        vip_locked: 'false', hasBoughtVIP: 0, created_at: getISOTimestamp(),
        nickname: '', avatar: '', bank_mtn: '', bank_airtel: ''
      }

      await redis.hset(`user:${phone}`, userData)
      await redis.sadd('users:phones', phone)
      if (upline1) await redis.sadd(`downlines:${upline1}:1`, phone)

      return NextResponse.json({ success: true, message: 'User registered' })
    }

    if (action === 'login') {
      const { password } = Object.fromEntries(searchParams)
      const { user } = await getUserData(phone)
      if (!user || user.password!== password) {
        return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 })
      }
      return NextResponse.json({ success: true, user })
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
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      return NextResponse.json({ success: true, transactions: filtered })
    }

    if (action === 'getDashboard') {
      const transactions = await getTransactions(phone)
      const recentTx = transactions.slice(0, 49)
      const vipTx = transactions.find(t => t.type === 'viptask_purchase')
      const vipPurchaseDate = vipTx? vipTx.created_at : null
      const { teamA, teamB, teamC } = await buildTeams(phone)
      const totalEarnings = transactions
   .filter(t => t.type === 'referral_reward' && t.status === 'success')
   .reduce((sum, t) => sum + Number(t.amount || 0), 0)
      const balance = Number(user.balance || 0)

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
          vipLocked: user.vip_locked === 'true',
          hasBoughtVIP: Number(user.hasBoughtVIP) === 1,
          tasksCompleted: Number(user.tasks_completed) || 0,
          vipPricePaid: Number(user.vip_price_paid) || 0,
          firstVipAmount: Number(user.first_vip_amount) || 0,
          bankMTN: user.bank_mtn? JSON.parse(user.bank_mtn) : null,
          bankAirtel: user.bank_airtel? JSON.parse(user.bank_airtel) : null,
          referralPaid: user.referral_paid === 'true',
          upline1: user.upline1 || '',
          upline2: user.upline2 || '',
          upline3: user.upline3 || '',
          createdAt: user.created_at || ''
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

    const balance = Number(user.balance || 0)
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
        bankMTN: user.bank_mtn? JSON.parse(user.bank_mtn) : null,
        bankAirtel: user.bank_airtel? JSON.parse(user.bank_airtel) : null,
        vipLocked: user.vip_locked === 'true',
        hasBoughtVIP: Number(user.hasBoughtVIP) === 1,
        tasksCompleted: Number(user.tasks_completed) || 0,
        vipPricePaid: Number(user.vip_price_paid) || 0,
        firstVipAmount: Number(user.first_vip_amount) || 0,
        referralPaid: user.referral_paid === 'true',
        upline1: user.upline1 || '',
        upline2: user.upline2 || '',
        upline3: user.upline3 || '',
        createdAt: user.created_at || ''
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
    let { action, phone, field, value, oldPass, newPass, number, method, names, amount, txId, adminPhone, vipLevel } = body

    phone = normalizePhone(phone)
    adminPhone = normalizePhone(adminPhone)

    if (!phone) return NextResponse.json({ success: false, message: 'Phone must be 10 digits starting with 07' }, { status: 400 })

    const { user } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    // User deposit request
    if (action === 'deposit') {
      const depositAmount = Number(value)
      if (!depositAmount || depositAmount <= 0) {
        return NextResponse.json({ success: false, message: 'Invalid deposit amount' }, { status: 400 })
      }

      const txId = generateId()
      const tx = {
        id: txId,
        type: 'deposit',
        amount: depositAmount,
        method: method || '',
        created_at: getISOTimestamp(),
        status: 'pending',
        desc: `Deposit via ${method || 'Mobile Money'}`,
        phone: phone,
        userPhone: phone
      }

      await pushTransaction(phone, tx)
      await redis.hset(`admin_deposit:${txId}`, {
        id: txId,
        admin_phone: ADMIN_PHONE,
        data: JSON.stringify(tx),
        status: 'pending'
      })

      return NextResponse.json({ success: true, tx, message: 'Deposit request submitted. Pending admin approval.' })
    }

    // Admin approve deposit
    if (action === 'approve_deposit') {
      if (adminPhone!== ADMIN_PHONE) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
      }
      if (!txId) {
        return NextResponse.json({ success: false, message: 'Transaction ID required' }, { status: 400 })
      }

      const deposit = await redis.hgetall(`admin_deposit:${txId}`)
      if (!deposit || deposit.status!== 'pending') {
        return NextResponse.json({ success: false, message: 'Deposit not found' }, { status: 404 })
      }

      const txData = JSON.parse(deposit.data)
      const targetPhone = normalizePhone(txData.userPhone)

      await addBalance(targetPhone, Number(txData.amount))
      await redis.hset(`admin_deposit:${txId}`, { status: 'success' })

      const txList = await redis.lrange(`tx:${targetPhone}`, 0, 999)
      for (let i = 0; i < txList.length; i++) {
        const t = JSON.parse(txList[i])
        if (t.id === txId) {
          t.status = 'success'
          await redis.lset(`tx:${targetPhone}`, i, JSON.stringify(t))
          break
        }
      }

      return NextResponse.json({ success: true, message: 'Deposit approved' })
    }

    // Admin reject deposit
    if (action === 'reject_deposit') {
      if (adminPhone!== ADMIN_PHONE) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
      }
      if (!txId) {
        return NextResponse.json({ success: false, message: 'Transaction ID required' }, { status: 400 })
      }

      const deposit = await redis.hgetall(`admin_deposit:${txId}`)
      if (!deposit || deposit.status!== 'pending') {
        return NextResponse.json({ success: false, message: 'Deposit not found' }, { status: 404 })
      }

      await redis.hset(`admin_deposit:${txId}`, { status: 'rejected' })

      const txData = JSON.parse(deposit.data)
      const targetPhone = normalizePhone(txData.userPhone)

      const txList = await redis.lrange(`tx:${targetPhone}`, 0, 999)
      for (let i = 0; i < txList.length; i++) {
        const t = JSON.parse(txList[i])
        if (t.id === txId) {
          t.status = 'rejected'
          await redis.lset(`tx:${targetPhone}`, i, JSON.stringify(t))
          break
        }
      }

      return NextResponse.json({ success: true, message: 'Deposit rejected' })
    }

    // User withdraw request
    if (action === 'withdraw') {
      const { open } = isWithdrawOpen()
      if (!open) {
        return NextResponse.json({
          success: false,
          message: 'Withdrawals are only available Monday to Friday, 10:00 AM - 5:00 PM EAT'
        }, { status: 403 })
      }

      const amount = Number(value)
      const balance = Number(user.balance || 0)
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
        id: generateId(),
        type: 'withdraw',
        amount: -amount,
        netAmount: netAmount,
        fee: fee,
        method: method || '',
        number: withdrawalPhone,
        names: names,
        created_at: getISOTimestamp(),
        status: 'pending',
        desc: `Withdraw to ${method} - ${withdrawalPhone} - ${names}`,
        phone: phone
      }

      await pushTransaction(phone, tx)
      await redis.hset(`admin_withdraw:${tx.id}`, {
        id: tx.id,
        admin_phone: ADMIN_PHONE,
        data: JSON.stringify(tx),
        status: 'pending'
      })

      return NextResponse.json({ success: true, tx, message: 'Withdraw request submitted. Pending approval.' })
    }

    // Admin approve withdraw
    if (action === 'approve_withdraw') {
      if (adminPhone!== ADMIN_PHONE) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
      }
      if (!txId) {
        return NextResponse.json({ success: false, message: 'Transaction ID required' }, { status: 400 })
      }

      const withdraw = await redis.hgetall(`admin_withdraw:${txId}`)
      if (!withdraw || withdraw.status!== 'pending') {
        return NextResponse.json({ success: false, message: 'Withdraw not found' }, { status: 404 })
      }

      const txData = JSON.parse(withdraw.data)
      const targetPhone = normalizePhone(txData.phone)

      await redis.hset(`admin_withdraw:${txId}`, { status: 'success' })

      const txList = await redis.lrange(`tx:${targetPhone}`, 0, 999)
      for (let i = 0; i < txList.length; i++) {
        const t = JSON.parse(txList[i])
        if (t.id === txId) {
          t.status = 'success'
          await redis.lset(`tx:${targetPhone}`, i, JSON.stringify(t))
          break
        }
      }

      return NextResponse.json({ success: true, message: 'Withdraw approved' })
    }

    // Admin reject withdraw
    if (action === 'reject_withdraw') {
      if (adminPhone!== ADMIN_PHONE) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
      }
      if (!txId) {
        return NextResponse.json({ success: false, message: 'Transaction ID required' }, { status: 400 })
      }

      const withdraw = await redis.hgetall(`admin_withdraw:${txId}`)
      if (!withdraw || withdraw.status!== 'pending') {
        return NextResponse.json({ success: false, message: 'Withdraw not found' }, { status: 404 })
      }

      const txData = JSON.parse(withdraw.data)
      const targetPhone = normalizePhone(txData.phone)
      const refundAmount = Math.abs(Number(txData.amount))

      await addBalance(targetPhone, refundAmount)
      await redis.hset(`admin_withdraw:${txId}`, { status: 'rejected' })

      const txList = await redis.lrange(`tx:${targetPhone}`, 0, 999)
      for (let i = 0; i < txList.length; i++) {
        const t = JSON.parse(txList[i])
        if (t.id === txId) {
          t.status = 'rejected'
          await redis.lset(`tx:${targetPhone}`, i, JSON.stringify(t))
          break
        }
      }

      return NextResponse.json({ success: true, message: 'Withdraw rejected and refunded' })
    }

    if (action === 'buyvip') {
      const currentVip = Number(user.vip) || 0
      const currentPricePaid = Number(user.vip_price_paid) || 0
      const vipLevelNum = Number(vipLevel)
      const config = VIP_CONFIG[vipLevelNum]
      if (!config) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })
      if (vipLevelNum <= currentVip) {
        return NextResponse.json({ success: false, message: 'Cannot downgrade VIP' }, { status: 400 })
      }

      const newPrice = Number(config.price)
      const balance = Number(user.balance || 0)
      const upgradeCost = newPrice - currentPricePaid

      if (balance < upgradeCost) {
        return NextResponse.json({ success: false, message: `Insufficient balance. Need ${upgradeCost}shs more` }, { status: 400 })
      }

      await addBalance(phone, -upgradeCost)

      const firstVipAmount = currentPricePaid === 0? newPrice : user.first_vip_amount

      await redis.hset(`user:${phone}`, {
        vip: vipLevelNum,
        vip_price_paid: newPrice,
        first_vip_amount: firstVipAmount,
        vip_locked: 'false',
        tasks_completed: 0,
        hasBoughtVIP: 1
      })

      const timestamp = getISOTimestamp()

      if (currentPricePaid > 0) {
        await pushTransaction(phone, {
          id: generateId(),
          type: 'refund',
          amount: currentPricePaid,
          created_at: timestamp,
          status: 'success',
          desc: `Refund VIP${currentVip} on upgrade to VIP${vipLevelNum}`,
          phone: phone
        })
      }

      await pushTransaction(phone, {
        id: generateId(),
        type: 'viptask_purchase',
        amount: -newPrice,
        created_at: timestamp,
        status: 'success',
        desc: `Bought VIP${vipLevelNum}`,
        phone: phone
      })

      if (currentVip === 0 && user.referral_paid!== 'true') {
        const paidPrice = Number(firstVipAmount)
        const rates = REWARD_TABLE[vipLevelNum]

        if (rates && paidPrice > 0) {
          if (user.upline1 && user.upline1!== phone) {
            const rewardA = Math.floor(paidPrice * rates.A)
            if (rewardA > 0) {
              await addBalance(user.upline1, rewardA)
              await pushTransaction(user.upline1, {
                id: generateId(),
                type: 'referral_reward',
                amount: rewardA,
                created_at: timestamp,
                status: 'success',
                desc: `Team A 5% from ${user.username || phone} buying VIP${vipLevelNum}`,
                phone: user.upline1
              })
            }
          }

          if (user.upline2 && user.upline2!== phone) {
            const rewardB = Math.floor(paidPrice * rates.B)
            if (rewardB > 0) {
              await addBalance(user.upline2, rewardB)
              await pushTransaction(user.upline2, {
                id: generateId(),
                type: 'referral_reward',
                amount: rewardB,
                created_at: timestamp,
                status: 'success',
                desc: `Team B 2% from ${user.username || phone} buying VIP${vipLevelNum}`,
                phone: user.upline2
              })
            }
          }

          if (user.upline3 && user.upline3!== phone) {
            const rewardC = Math.floor(paidPrice * rates.C)
            if (rewardC > 0) {
              await addBalance(user.upline3, rewardC)
              await pushTransaction(user.upline3, {
                id: generateId(),
                type: 'referral_reward',
                amount: rewardC,
                created_at: timestamp,
                status: 'success',
                desc: `Team C 1% from ${user.username || phone} buying VIP${vipLevelNum}`,
                phone: user.upline3
              })
            }
          }
        }

        await redis.hset(`user:${phone}`, { referral_paid: 'true' })
      }

      let freshUser = await getUserData(phone)
      return NextResponse.json({
        success: true,
        user: freshUser.user,
        message: `VIP${vipLevelNum} activated! Paid ${upgradeCost}shs`
      })
    }

    if (action === 'updateProfile') {
      if (field === 'nickname') {
        if (value.length > 6) return NextResponse.json({ success: false, message: 'Nickname max 6 letters' }, { status: 400 })
        await redis.hset(`user:${phone}`, { nickname: value })
        return NextResponse.json({ success: true, message: 'Nickname saved' })
      }
      if (field === 'bankMTN') {
        await redis.hset(`user:${phone}`, { bank_mtn: JSON.stringify(value) })
        return NextResponse.json({ success: true, message: 'MTN bank saved' })
      }
      if (field === 'bankAirtel') {
        await redis.hset(`user:${phone}`, { bank_airtel: JSON.stringify(value) })
        return NextResponse.json({ success: true, message: 'Airtel bank saved' })
      }
      if (field === 'avatar') {
        await redis.hset(`user:${phone}`, { avatar: value })
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
      await redis.hset(`user:${phone}`, { password: newPass })
      return NextResponse.json({ success: true, message: 'Password changed' })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err){
    console.error('POST /api/user error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}