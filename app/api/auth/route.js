import { kv } from '@vercel/kv'

const TZ = 'Africa/Kampala'

function getUGDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

function normalizePhone(phone) {
  if (!phone) return ''
  phone = String(phone).replace(/\D/g, '')
  if (!/^07\d{8}$/.test(phone)) {
    return ''
  }
  return phone
}

function getUserInviteCode(phone) {
  return `PM${phone.slice(-6)}`
}

function isValidInviteCode(code) {
  return /^PM\d{6}$/.test(code)
}

function normalizeUser(user) {
  if (!user) return null

  const balance = Number(user.balance ?? user.available_balance ?? 0)

  return {
    username: user.username,
    displayName: user.displayName || user.username || '',
    phone: user.phone,
    balance: balance,
    available_balance: balance,
    vip: Number(user.vip) || 0,
    vipLocked: user.vipLocked === 'true',
    tasksCompleted: Number(user.tasksCompleted) || 0,
    referralCode: user.referralCode || '',
    upline1: user.upline1 || '',
    upline2: user.upline2 || '',
    upline3: user.upline3 || '',
    referralPaid: user.referralPaid || 'false',
    role: user.role || 'user',
    hasBoughtVIP: user.hasBoughtVIP === 'true',
    regDate: user.regDate || ''
  }
}

async function syncBalanceFields(phone, amount) {
  const userKey = `user:${phone}`
  const amountStr = String(amount)
  await kv.hset(userKey, {
    balance: amountStr,
    available_balance: amountStr
  })
}

export async function POST(request) {
  try {
    const body = await request.json()
    let { action, username, password, phone, referral } = body

    // REGISTER
    if (action === 'register') {
      if (!username || !password || !phone) {
        return Response.json({ success: false, message: 'All fields required' })
      }

      phone = normalizePhone(phone)
      if (!phone) {
        return Response.json({ success: false, message: 'Phone must be 10 digits starting with 07' })
      }

      if (password.length < 6) {
        return Response.json({ success: false, message: 'Password must be at least 6 characters' })
      }

      if (!/^[a-zA-Z0-9]{3,6}$/.test(username)) {
        return Response.json({ success: false, message: 'Username must be 3-6 letters or digits only' })
      }

      const userKey = `user:${phone}`
      const usernameKey = `username:${username}`

      if ((await kv.type(userKey)) === 'hash') {
        return Response.json({ success: false, message: 'Phone already registered' })
      }

      if ((await kv.type(usernameKey)) === 'hash') {
        return Response.json({ success: false, message: 'Username taken' })
      }

      let upline1 = '', upline2 = '', upline3 = ''

      if (referral) {
        if (!isValidInviteCode(referral)) {
          return Response.json({ success: false, message: 'Invalid referral code format' })
        }

        const upline1Phone = await kv.get(`referral:${referral}`)
        if (!upline1Phone) {
          return Response.json({ success: false, message: 'Referral code not found' })
        }

        if (upline1Phone === phone) {
          return Response.json({ success: false, message: 'Cannot use your own referral code' })
        }

        upline1 = upline1Phone

        const upline1Data = await kv.hgetall(`user:${upline1Phone}`)
        if (upline1Data?.upline1) upline2 = upline1Data.upline1

        if (upline2) {
          const upline2Data = await kv.hgetall(`user:${upline2}`)
          if (upline2Data?.upline1) upline3 = upline2Data.upline1
        }

        await kv.sadd(`user:${upline1}:downline1`, phone)
        if (upline2) await kv.sadd(`user:${upline2}:downline2`, phone)
        if (upline3) await kv.sadd(`user:${upline3}:downline3`, phone)
      }

      const inviteCode = getUserInviteCode(phone)
      const regDate = getUGDateStr()

      // Register: only create user + 2500shs balance. No VIP logic here.
      await kv.hset(userKey, {
        username,
        displayName: username,
        phone,
        password,
        balance: '2500',
        available_balance: '2500',
        referralCode: inviteCode,
        upline1,
        upline2,
        upline3,
        referralPaid: 'false',
        role: 'user',
        regDate
      })

      await kv.hset(usernameKey, { phone })
      await kv.set(`referral:${inviteCode}`, phone)

      return Response.json({
        success: true,
        message: 'Registered successfully',
        inviteCode
      })
    }

    // LOGIN
    if (action === 'login') {
      if (!phone || !password) {
        return Response.json({ success: false, message: 'Phone and password required' })
      }

      phone = normalizePhone(phone)
      if (!phone) {
        return Response.json({ success: false, message: 'Phone must be 10 digits starting with 07' })
      }

      const user = await kv.hgetall(`user:${phone}`)

      if (!user || Object.keys(user).length === 0) {
        return Response.json({ success: false, message: 'User not found' })
      }

      if (String(user.password) !== String(password)) {
        return Response.json({ success: false, message: 'Invalid password' })
      }

      // Sync fields if they differ
      const currentBalance = Number(user.balance ?? user.available_balance ?? 0)
      if (String(user.balance) !== String(currentBalance) || String(user.available_balance) !== String(currentBalance)) {
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