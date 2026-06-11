import { kv } from '@vercel/kv'

function getUserInviteCode(phone) {
  const clean = phone.replace(/\D/g, '')
  const last6 = clean.slice(-6)
  return `PM${last6}`
}

function isValidInviteCode(code) {
  return /^PM\d{6}$/.test(code)
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, username, password, phone, referral } = body
    const cleanPhone = phone?.replace(/\s+/g, '')
    const userKey = `phone:palamedes:${cleanPhone}`
    const usernameKey = `user:palamedes:${username?.toLowerCase()}`

    // REGISTER
    if (action === 'register') {
      if (!username || !password || !cleanPhone) {
        return Response.json({ success: false, message: 'All fields required' })
      }

      if (password.length < 6) {
        return Response.json({ success: false, message: 'Password must be at least 6 characters' })
      }

      if (referral && !isValidInviteCode(referral)) {
        return Response.json({ success: false, message: 'Invalid referral code' })
      }

      // Block self-referral
      const myInviteCode = getUserInviteCode(cleanPhone)
      if (referral === myInviteCode) {
        return Response.json({ success: false, message: 'Cannot use your own referral code' })
      }

      // Build upline chain A, B, C
      let upline1 = '', upline2 = '', upline3 = ''
      
      if (referral) {
        const upline1Phone = await kv.get(`invite:${referral}`)
        if (!upline1Phone) {
          return Response.json({ success: false, message: 'Referral code not found' })
        }
        upline1 = upline1Phone

        // Get upline2
        const upline1Data = await kv.hgetall(`phone:palamedes:${upline1Phone}`)
        if (upline1Data?.referral) {
          const upline2Phone = await kv.get(`invite:${upline1Data.referral}`)
          if (upline2Phone) upline2 = upline2Phone
        }

        // Get upline3
        if (upline2) {
          const upline2Data = await kv.hgetall(`phone:palamedes:${upline2}`)
          if (upline2Data?.referral) {
            const upline3Phone = await kv.get(`invite:${upline2Data.referral}`)
            if (upline3Phone) upline3 = upline3Phone
          }
        }
      }

      const exists = await kv.exists(userKey)
      if (exists) {
        return Response.json({ success: false, message: 'Phone already registered' })
      }

      const userExists = await kv.exists(usernameKey)
      if (userExists) {
        return Response.json({ success: false, message: 'Username taken' })
      }

      await kv.hset(userKey, {
        username,
        phone: cleanPhone,
        password,
        balance: '0',
        vip: '0',
        vipPricePaid: '0',
        vipLocked: 'false',
        tasksCompleted: '0',
        referral: referral || '',
        upline1,
        upline2,
        upline3,
        referralPaid: 'false'
      })
      
      await kv.hset(usernameKey, { phone: cleanPhone })

      // Create invite code mapping for this user
      const inviteCode = getUserInviteCode(cleanPhone)
      await kv.set(`invite:${inviteCode}`, cleanPhone)

      return Response.json({ 
        success: true, 
        message: 'Registered successfully',
        inviteCode 
      })
    }

    // LOGIN
    if (action === 'login') {
      if (!cleanPhone || !password) {
        return Response.json({ success: false, message: 'Phone and password required' })
      }

      const user = await kv.hgetall(userKey)
      if (!user || !user.username) {
        return Response.json({ success: false, message: 'User not found' })
      }

      if (String(user.password) !== String(password)) {
        return Response.json({ success: false, message: 'Invalid password' })
      }

      return Response.json({
        success: true,
        user: {
          username: user.username,
          phone: user.phone,
          balance: Number(user.balance) || 0,
          vip: Number(user.vip) || 0,
          vipLocked: user.vipLocked === 'true',
          tasksCompleted: Number(user.tasksCompleted) || 0,
          referral: user.referral || '',
          upline1: user.upline1 || '',
          upline2: user.upline2 || '',
          upline3: user.upline3 || '',
          referralPaid: user.referralPaid || 'false'
        }
      })
    }

    return Response.json({ success: false, message: 'Invalid action' })
  } catch (err) {
    console.error('Auth error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}