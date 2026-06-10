import { kv } from '@vercel/kv'

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
        referral: referral || ''
      })
      
      await kv.hset(usernameKey, { phone: cleanPhone })

      return Response.json({ success: true, message: 'Registered successfully' })
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
          tasksCompleted: Number(user.tasksCompleted) || 0
        }
      })
    }

    return Response.json({ success: false, message: 'Invalid action' })
  } catch (err) {
    console.error('Auth error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}