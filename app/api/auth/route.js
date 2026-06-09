import { db } from '../redis.js'

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, username, phone, password, referral } = body

    const cleanPhone = phone ? phone.replace(/\s+/g, '') : ''
    const userKey = username ? `user:palamedes:${username.toLowerCase()}` : null
    const phoneKey = cleanPhone ? `phone:palamedes:${cleanPhone}` : null

    // REGISTER
    if (action === 'register') {
      if (!username || username.length < 6) {
        return Response.json({ success: false, message: 'Username must be 6 letters minimum' }, { status: 400 })
      }

      const existingUser = userKey ? await db.hgetall(userKey) : null
      if (existingUser && existingUser.username) {
        return Response.json({ success: false, message: 'Username already taken' }, { status: 400 })
      }

      const existingPhone = phoneKey ? await db.hgetall(phoneKey) : null
      if (existingPhone && existingPhone.username) {
        return Response.json({ success: false, message: 'Phone number already registered' }, { status: 400 })
      }

      let referrerId = null
      let teamA = null
      let teamB = null
      let teamC = null

      if (referral && referral.trim() !== '') {
        const referrer = await db.hgetall(`user:palamedes:${referral.toLowerCase()}`)
        if (!referrer || !referrer.id) {
          return Response.json({ success: false, message: 'Invalid referral code' }, { status: 400 })
        }
        referrerId = referrer.id
        teamA = referrer.id
        teamB = referrer.referrer || null
        teamC = referrer.teamA || null
      }

      const newUser = {
        id: Date.now().toString(),
        username,
        phone: cleanPhone,
        password,
        referral: referral || '',
        referrer: referrerId || '',
        teamA: teamA || '',
        teamB: teamB || '',
        teamC: teamC || '',
        balance: '0',
        vip: '0',
        createdAt: new Date().toISOString()
      }

      await db.hset(userKey, newUser)
      await db.hset(phoneKey, newUser)
      
      const testRead = await db.hgetall(userKey)
      const redisTestMsg = testRead && testRead.username ? `KV OK: Saved ${username}` : 'KV FAIL: Could not read back'

      return Response.json({ 
        success: true, 
        message: 'Account created successfully',
        redisTest: redisTestMsg,
        user: { 
          username: newUser.username, 
          phone: newUser.phone,
          name: newUser.username,
          balance: newUser.balance,
          vip: newUser.vip
        }
      })
    }

    // LOGIN - FIXED
    if (action === 'login') {
      if (!phoneKey) {
        return Response.json({ success: false, message: 'Phone number required' }, { status: 400 })
      }

      const user = await db.hgetall(phoneKey)
      
      // FIX: KV returns {} not null when key missing. Also check username exists
      if (!user || !user.username || Object.keys(user).length === 0) {
        return Response.json({ success: false, message: 'Phone not registered' }, { status: 401 })
      }
      
      // FIX: Trim password to handle accidental space
      if (user.password !== password.trim()) {
        return Response.json({ success: false, message: 'Invalid phone or password' }, { status: 401 })
      }

      return Response.json({ 
        success: true, 
        message: 'Login successful',
        user: { 
          username: user.username, 
          phone: user.phone,
          name: user.username,
          balance: user.balance,
          vip: user.vip
        }
      })
    }

    return Response.json({ success: false, message: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error(err)
    return Response.json({ success: false, message: 'Server error: ' + err.message }, { status: 500 })
  }
}