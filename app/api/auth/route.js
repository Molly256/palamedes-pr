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
    let { action, username, password, phone, referral } = body
    
    const cleanPhone = phone?.replace(/\s+/g, '')

    // Normalize username to lowercase for keys and uniqueness
    username = username?.trim().toLowerCase()
    if (username && !/^[a-z0-9_]{3,20}$/.test(username)) {
      return Response.json({ success: false, message: 'Username must be 3-20 lowercase letters, numbers, or _' })
    }

    const userKey = `user:${cleanPhone}`
    const usernameKey = `username:${username}`

    // REGISTER
    if (action === 'register') {
      if (!username || !password || !cleanPhone) {
        return Response.json({ success: false, message: 'All fields required' })
      }

      if (password.length < 6) {
        return Response.json({ success: false, message: 'Password must be at least 6 characters' })
      }

      referral = referral ? referral.trim().toUpperCase() : ''

      if (referral && !isValidInviteCode(referral)) {
        return Response.json({ success: false, message: 'Invalid referral code format' })
      }

      const myInviteCode = getUserInviteCode(cleanPhone)
      if (referral === myInviteCode) {
        return Response.json({ success: false, message: 'Cannot use your own referral code' })
      }

      let upline1 = '', upline2 = '', upline3 = ''
      
      if (referral) {
        const upline1Phone = await kv.get(`referral:${referral}`)
        if (!upline1Phone) {
          return Response.json({ success: false, message: 'Referral code not found' })
        }
        upline1 = upline1Phone

        const upline1Key = `user:${upline1Phone}`
        if ((await kv.type(upline1Key)) === 'hash') {
          const upline1Data = await kv.hgetall(upline1Key)
          if (upline1Data?.referralCode) {
            const upline2Phone = await kv.get(`referral:${upline1Data.referralCode}`)
            if (upline2Phone) upline2 = upline2Phone
          }
        }

        if (upline2) {
          const upline2Key = `user:${upline2}`
          if ((await kv.type(upline2Key)) === 'hash') {
            const upline2Data = await kv.hgetall(upline2Key)
            if (upline2Data?.referralCode) {
              const upline3Phone = await kv.get(`referral:${upline2Data.referralCode}`)
              if (upline3Phone) upline3 = upline3Phone
            }
          }
        }
      }

      // Check if phone exists
      if ((await kv.type(userKey)) === 'hash') {
        return Response.json({ success: false, message: 'Phone already registered' })
      }

      // Clean ALL case variants of username key to prevent WRONGTYPE
      const variants = [
        `username:${username}`,
        `username:${username.toLowerCase()}`,
        `username:${username.toUpperCase()}`,
        `username:${username.charAt(0).toUpperCase() + username.slice(1)}`
      ]
      const uniqueVariants = [...new Set(variants)]
      
      for (const key of uniqueVariants) {
        const t = await kv.type(key)
        if (t === 'string') await kv.del(key)
        if (t === 'hash') {
          return Response.json({ success: false, message: 'Username taken' })
        }
      }

      const inviteCode = getUserInviteCode(cleanPhone)
      
      await kv.hset(userKey, {
        username,
        displayName: body.username?.trim(),
        phone: cleanPhone,
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
        hasBoughtVIP: 'false'
      })
      
      await kv.hset(usernameKey, { phone: cleanPhone })
      await kv.set(`referral:${inviteCode}`, cleanPhone)

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
      
      if (!user || Object.keys(user).length === 0) {
        return Response.json({ success: false, message: 'User not found' })
      }

      if (String(user.password) !== String(password)) {
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
          hasBoughtVIP: user.hasBoughtVIP === 'true'
        }
      })
    }

    return Response.json({ success: false, message: 'Invalid action' })
  } catch (err) {
    console.error('Auth error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}