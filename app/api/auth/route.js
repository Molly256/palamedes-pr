import { kv } from '@vercel/kv'

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '') // remove +, spaces, dashes

  // Convert 256753520252 -> 0753520252
  if (phone.startsWith('256') && phone.length === 12) {
    phone = '0' + phone.slice(3)
  }

  // Convert 753520252 -> 0753520252
  if (phone.length === 9 &&!phone.startsWith('0')) {
    phone = '0' + phone
  }

  return phone
}

function getUserInviteCode(phone) {
  return `PM${phone.slice(-6)}`
}

function isValidInviteCode(code) {
  return /^PM\d{6}$/.test(code)
}

export async function POST(request) {
  try {
    const body = await request.json()
    let { action, username, password, phone, referral } = body

    // REGISTER
    if (action === 'register') {
      if (!username ||!password ||!phone) {
        return Response.json({ success: false, message: 'All fields required' })
      }

      phone = normalizePhone(phone)

      if (!/^0\d{9}$/.test(phone)) {
        return Response.json({ success: false, message: 'Phone must be 10 digits starting with 0' })
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
      const regDate = new Date().toISOString().split('T')[0]

      await kv.hset(userKey, {
        username,
        displayName: username,
        phone,
        password,
        balance: '0',
        vip: '0',
        vipPricePaid: '0',
        vipLocked: 'false',
        tasksCompleted: '0',
        referralCode: inviteCode,
        upline1,
        upline2,
        upline3,
        referralPaid: 'false',
        role: 'user',
        hasBoughtVIP: 'false',
        regDate
      })

      await kv.hset(usernameKey, { phone })
      await kv.set(`referral:${inviteCode}`, phone)

      // Auto-create 4 VIP0 tasks for registration day
      const tasks = []
      for (let i = 1; i <= 4; i++) {
        const taskId = `vip0_${phone}_${regDate}_${i}`
        await kv.hset(taskId, {
          userPhone: phone,
          vipLevel: '0',
          bookId: i,
          reward: '625',
          status: 'pending',
          date: regDate
        })
        tasks.push(taskId)
      }
      await kv.sadd(`tasks:${phone}:${regDate}`,...tasks)

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

      phone = normalizePhone(phone)
      const user = await kv.hgetall(`user:${phone}`)

      if (!user || Object.keys(user).length === 0) {
        return Response.json({ success: false, message: 'User not found' })
      }

      if (String(user.password)!== String(password)) {
        return Response.json({ success: false, message: 'Invalid password' })
      }

      return Response.json({
        success: true,
        user: {
          username: user.username,
          displayName: user.displayName || user.username,
          phone: user.phone,
          balance: Number(user.balance) || 0,
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
      })
    }

    return Response.json({ success: false, message: 'Invalid action' })
  } catch (err) {
    console.error('Auth error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}