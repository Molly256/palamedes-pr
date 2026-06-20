import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'

const TZ = 'Africa/Kampala'

function getUGDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

function isValidInviteCode(code) {
  return /^PM\d{6}$/.test(code)
}

function getUserInviteCode(phone) {
  return `PM${phone.slice(-6)}`
}

function normalizeUser(user) {
  if (!user) return null

  const balance = Number(user.balance?? user.available_balance?? 0)

  return {
    username: user.username,
    phone: user.phone,
    balance: balance,
    available_balance: balance,
    vip: Number(user.vip) || 0,
    vipLocked: user.vipLocked === 'true' || user.vipLocked === 1,
    tasksCompleted: Number(user.tasksCompleted) || 0,
    referralCode: user.referralCode || '',
    upline1: user.upline1 || '',
    upline2: user.upline2 || '',
    upline3: user.upline3 || '',
    referralPaid: user.referralPaid || 'false',
    role: user.role || 'user',
    hasBoughtVIP: user.hasBoughtVIP === 'true' || user.hasBoughtVIP === 1,
    regDate: user.regDate || ''
  }
}

async function syncBalanceFields(phone, amount) {
  const amountStr = String(amount)
  await db.execute(
    'UPDATE users SET balance =?, available_balance =? WHERE phone =?',
    [amountStr, amountStr, phone]
  )
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, username, password, phone, referral } = body

    // REGISTER
    if (action === 'register') {
      if (!username ||!password ||!phone) {
        return Response.json({ success: false, message: 'All fields required' })
      }

      // No normalizePhone - use phone exactly as sent
      if (!/^07\d{8}$/.test(phone)) {
        return Response.json({ success: false, message: 'Phone must be 10 digits starting with 07' })
      }

      // Exactly 6 chars
      if (!/^[a-zA-Z0-9]{6}$/.test(username)) {
        return Response.json({ success: false, message: 'Username must be exactly 6 letters or digits' })
      }

      if (!/^[a-zA-Z0-9]{6}$/.test(password)) {
        return Response.json({ success: false, message: 'Password must be exactly 6 letters or digits' })
      }

      const existingUser = await db.execute('SELECT phone FROM users WHERE phone =?', [phone])
      if (existingUser.rows.length > 0) {
        return Response.json({ success: false, message: 'Phone already registered' })
      }

      const existingUsername = await db.execute('SELECT phone FROM usernames WHERE username =?', [username])
      if (existingUsername.rows.length > 0) {
        return Response.json({ success: false, message: 'Username taken' })
      }

      let upline1 = '', upline2 = '', upline3 = ''

      if (referral) {
        if (!isValidInviteCode(referral)) {
          return Response.json({ success: false, message: 'Invalid referral code format' })
        }

        const refRes = await db.execute('SELECT phone FROM referrals WHERE code =?', [referral])
        if (refRes.rows.length === 0) {
          return Response.json({ success: false, message: 'Referral code not found' })
        }

        const upline1Phone = refRes.rows[0].phone
        if (upline1Phone === phone) {
          return Response.json({ success: false, message: 'Cannot use your own referral code' })
        }

        upline1 = upline1Phone

        const upline1Data = await db.execute('SELECT upline1, upline2 FROM users WHERE phone =?', [upline1Phone])
        if (upline1Data.rows[0]?.upline1) upline2 = upline1Data.rows[0].upline1
        if (upline2) {
          const upline2Data = await db.execute('SELECT upline1 FROM users WHERE phone =?', [upline2])
          if (upline2Data.rows[0]?.upline1) upline3 = upline2Data.rows[0].upline1
        }

        await db.execute('INSERT INTO downlines(phone, downline_phone, level) VALUES (?,?,1)', [upline1, phone])
        if (upline2) await db.execute('INSERT INTO downlines(phone, downline_phone, level) VALUES (?,?,2)', [upline2, phone])
        if (upline3) await db.execute('INSERT INTO downlines(phone, downline_phone, level) VALUES (?,?,3)', [upline3, phone])
      }

      const inviteCode = getUserInviteCode(phone)
      const regDate = getUGDateStr()
      const hashedPassword = await bcrypt.hash(password, 10)

      await db.execute(
        `INSERT INTO users(phone, username, password_hash, balance, available_balance,
         referralCode, upline1, upline2, upline3, referralPaid, role, regDate)
         VALUES (?,?,?,?,2500,2500,?,?,?,?, 'false', 'user',?)`,
        [phone, username, hashedPassword, inviteCode, upline1, upline2, upline3, regDate]
      )

      await db.execute('INSERT INTO usernames(username, phone) VALUES (?,?)', [username, phone])
      await db.execute('INSERT INTO referrals(code, phone) VALUES (?,?)', [inviteCode, phone])

      return Response.json({
        success: true,
        message: 'Registered successfully',
        inviteCode
      })
    }

    // LOGIN
    if (action === 'login') {
      if (!phone ||!password) {
        return Response.json({ success: false, message: 'Phone and password required' })
      }

      // No normalizePhone - use phone exactly as sent
      if (!/^07\d{8}$/.test(phone)) {
        return Response.json({ success: false, message: 'Phone must be 10 digits starting with 07' })
      }

      const res = await db.execute('SELECT * FROM users WHERE phone =?', [phone])
      const user = res.rows[0]

      if (!user) {
        return Response.json({ success: false, message: 'User not found' })
      }

      const passwordMatch = await bcrypt.compare(password, user.password_hash)
      if (!passwordMatch) {
        return Response.json({ success: false, message: 'Invalid password' })
      }

      const currentBalance = Number(user.balance?? user.available_balance?? 0)
      if (String(user.balance)!== String(currentBalance) || String(user.available_balance)!== String(currentBalance)) {
        await syncBalanceFields(phone, currentBalance)
      }

      const normalizedUser = normalizeUser(user)

      return Response.json({
        success: true,
        user: normalizedUser
      })
    }

    return Response.json({ success: false, message: 'Invalid action' })
  } catch (err) {
    console.error('Auth error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}