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
    const newKey = `user:0753520252:${cleanPhone}`
    const oldKey = `phone:palamedes:${cleanPhone}`
    const usernameKey = `username:${username?.toLowerCase()}`

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

        const upline1Key = `user:0753520252:${upline1Phone}`
        if ((await kv.type(upline1Key)) === 'hash') {
          const upline1Data = await kv.hgetall(upline1Key)
          if (upline1Data?.referralCode) {
            const upline2Phone = await kv.get(`referral:${upline1Data.referralCode}`)
            if (upline2Phone) upline2 = upline2Phone
          }
        }

        if (upline2) {
          const upline2Key = `user:0753520252:${upline2}`
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
      const newKeyType = await kv.type(newKey)
      const oldKeyType = await kv.type(oldKey)
      if (newKeyType === 'hash' || oldKeyType === 'hash') {
        return Response.json({ success: false, message: 'Phone already registered' })
      }
      if (newKeyType === 'string') await kv.del(newKey)
      if (oldKeyType === 'string') await kv.del(oldKey)

      // Check username and clean bad string keys
      const usernameType = await kv.type(usernameKey)
      if (usernameType === 'string') {
        await kv.del(usernameKey)
      }
      if (usernameType === 'hash') {
        return Response.json({ success: false, message: 'Username taken' })
      }

      const inviteCode = getUserInviteCode(cleanPhone)
      
      await kv.hset(newKey, {
        username,
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
        referralPaid: 'false'
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

      let user = null

      const newKeyType = await kv.type(newKey)
      if (newKeyType === 'hash') {
        user = await kv.hgetall(newKey)
      } else if (newKeyType === 'string') {
        await kv.del(newKey)
      }

      if (!user) {
        const oldKeyType = await kv.type(oldKey)
        if (oldKeyType === 'hash') {
          user = await kv.hgetall(oldKey)
        } else if (oldKeyType === 'string') {
          await kv.del(oldKey)
        }
      }
      
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
          referralCode: user.referralCode || '',
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