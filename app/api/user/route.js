import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

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

// 5% Team A, 2% Team B, 1% Team C for all VIP levels
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
  return `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
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
  const result = await db.execute(sql`SELECT * FROM users WHERE phone = ${phone} LIMIT 1`)
  const user = result.rows[0] || null
  return { user }
}

async function addBalance(phone, amount) {
  if (!phone) return
  await db.execute(sql`
    UPDATE users
    SET balance = balance + ${amount}, available_balance = available_balance + ${amount}
    WHERE phone = ${phone}
  `)
}

async function getTransactions(phone) {
  if (!phone) return []
  const result = await db.execute(sql`
    SELECT * FROM transactions
    WHERE phone = ${phone}
    ORDER BY created_at DESC
    LIMIT 99
  `)
  return result.rows
}

async function pushTransaction(phone, tx) {
  if (!phone) return
  await db.execute(sql`
    INSERT INTO transactions (id, phone, type, amount, net_amount, fee, method, number, names, created_at, status, desc)
    VALUES (${tx.id}, ${phone}, ${tx.type}, ${tx.amount}, ${tx.netAmount || null}, ${tx.fee || null},
            ${tx.method || null}, ${tx.number || null}, ${tx.names || null}, ${tx.created_at}, ${tx.status}, ${tx.desc})
  `)
}

async function buildTeams(phone) {
  if (!phone) return { teamA: [], teamB: [], teamC: [] }
  const allUsers = await db.execute(sql`SELECT * FROM users`)
  const users = allUsers.rows

  const teamA = users.filter(u => normalizePhone(u.upline1) === phone)
  const teamAPhones = new Set(teamA.map(u => u.phone))
  const teamB = users.filter(u => teamAPhones.has(normalizePhone(u.upline1)))
  const teamBPhones = new Set(teamB.map(u => u.phone))
  const teamC = users.filter(u => teamBPhones.has(normalizePhone(u.upline1)))

  return { teamA, teamB, teamC }
}

async function requireAuth(request, phone) {
  const token = request.headers.get('x-session-token')
  if (!token ||!phone) return false
  const result = await db.execute(sql`SELECT phone FROM sessions WHERE token = ${token} LIMIT 1`)
  return result.rows[0]?.phone === phone
}

async function createSession(phone) {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  await db.execute(sql`
    INSERT INTO sessions (token, phone, expires_at)
    VALUES (${token}, ${phone}, ${expiresAt})
  `)
  return token
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

      await db.execute(sql`
        INSERT INTO users (
          phone, username, password, upline1, upline2, upline3,
          referral_paid, vip, balance, available_balance,
          vip_price_paid, first_vip_amount, tasks_completed,
          vip_locked, hasBoughtVIP, created_at
        )
        VALUES (
          ${phone}, ${username}, ${password}, ${upline1}, ${upline2}, ${upline3},
          'false', 0, 2500, 2500, 0, 0, 0,
          'false', 0, ${getISOTimestamp()}
        )
      `)

      const token = await createSession(phone)
      return NextResponse.json({ success: true, message: 'User registered', token })
    }

    if (action === 'login') {
      const { password } = Object.fromEntries(searchParams)
      const { user } = await getUserData(phone)
      if (!user || user.password!== password) {
        return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 })
      }
      const token = await createSession(phone)
      return NextResponse.json({ success: true, token })
    }

    const { user } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    if (action!== 'getDashboard' && action!== 'getTransactions') {
      if (!(await requireAuth(request, phone))) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
      }
    }

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
          hasBoughtVIP: user.hasBoughtVIP === 1,
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
        hasBoughtVIP: user.hasBoughtVIP === 1,
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

    if (!(await requireAuth(request, phone))) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

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
      await db.execute(sql`
        INSERT INTO admin_deposits (id, admin_phone, data, status)
        VALUES (${txId}, ${ADMIN_PHONE}, ${JSON.stringify(tx)}, 'pending')
      `)

      return NextResponse.json({ success: true, tx, message: 'Deposit request submitted. Pending admin approval.' })
    }

    if (action === 'confirmDeposit') {
      if (adminPhone!== ADMIN_PHONE) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
      }
      if (!txId) {
        return NextResponse.json({ success: false, message: 'Transaction ID required' }, { status: 400 })
      }

      const deposit = await db.execute(sql`
        SELECT * FROM admin_deposits WHERE id = ${txId} AND status = 'pending' LIMIT 1
      `)
      const tx = deposit.rows[0]
      if (!tx) {
        return NextResponse.json({ success: false, message: 'Deposit not found' }, { status: 404 })
      }

      const txData = JSON.parse(tx.data)
      const targetPhone = txData.userPhone
      const { user: targetUser } = await getUserData(targetPhone)
      if (!targetUser) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
      }

      await addBalance(targetPhone, Number(txData.amount))
      await db.execute(sql`
        UPDATE admin_deposits SET status = 'success' WHERE id = ${txId}
      `)
      await db.execute(sql`
        UPDATE transactions SET status = 'success' WHERE id = ${txId}
      `)

      return NextResponse.json({ success: true, message: 'Deposit confirmed' })
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
      return NextResponse.json({ success: true, tx, message: 'Withdraw request submitted. Pending approval.' })
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

      // Set first_vip_amount only on first purchase
      const firstVipAmount = currentPricePaid === 0? newPrice : user.first_vip_amount

      await db.execute(sql`
        UPDATE users SET
          vip = ${vipLevelNum},
          vip_price_paid = ${newPrice},
          first_vip_amount = ${firstVipAmount},
          vip_locked = 'false',
          tasks_completed = 0,
          hasBoughtVIP = 1
        WHERE phone = ${phone}
      `)

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

      // Pay referral rewards only on first VIP purchase - 5%, 2%, 1%
      if (currentVip === 0 && user.referral_paid!== 'true') {
        const paidPrice = Number(firstVipAmount)
        const rates = REWARD_TABLE[vipLevelNum]

        if (rates && paidPrice > 0) {
          // Team A - upline1
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

          // Team B - upline2
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

          // Team C - upline3
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

        await db.execute(sql`UPDATE users SET referral_paid = 'true' WHERE phone = ${phone}`)
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
        await db.execute(sql`UPDATE users SET nickname = ${value} WHERE phone = ${phone}`)
        return NextResponse.json({ success: true, message: 'Nickname saved' })
      }
      if (field === 'bankMTN') {
        await db.execute(sql`UPDATE users SET bank_mtn = ${JSON.stringify(value)} WHERE phone = ${phone}`)
        return NextResponse.json({ success: true, message: 'MTN bank saved' })
      }
      if (field === 'bankAirtel') {
        await db.execute(sql`UPDATE users SET bank_airtel = ${JSON.stringify(value)} WHERE phone = ${phone}`)
        return NextResponse.json({ success: true, message: 'Airtel bank saved' })
      }
      if (field === 'avatar') {
        await db.execute(sql`UPDATE users SET avatar = ${value} WHERE phone = ${phone}`)
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
      await db.execute(sql`UPDATE users SET password = ${newPass} WHERE phone = ${phone}`)
      return NextResponse.json({ success: true, message: 'Password changed' })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err){
    console.error('POST /api/user error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}