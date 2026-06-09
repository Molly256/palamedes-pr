import { db } from '../../redis.js' // NEW: import Redis client

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, username, phone, password, referral } = body

    const cleanPhone = phone ? phone.replace(/\s+/g, '') : ''

    // REGISTER
    if (action === 'register') {
      if (!username || username.length < 6) {
        return Response.json({ success: false, message: 'Username must be 6 letters minimum' }, { status: 400 })
      }

      // NEW: Check Redis instead of memory array
      const existingUser = await db.get(`user:${username.toLowerCase()}`)
      if (existingUser) {
        return Response.json({ success: false, message: 'Username already taken' }, { status: 400 })
      }

      const existingPhone = await db.get(`phone:${cleanPhone}`)
      if (existingPhone) {
        return Response.json({ success: false, message: 'Phone number already registered' }, { status: 400 })
      }

      // NEW: Validate referral and build team chain
      let referrerId = null
      let teamA = null // Direct referrer - 5%
      let teamB = null // Referrer's referrer - 2%
      let teamC = null // Referrer's referrer's referrer - 1%

      if (referral && referral.trim() !== '') {
        const referrer = await db.get(`user:${referral.toLowerCase()}`)
        if (!referrer) {
          return Response.json({ success: false, message: 'Invalid referral code' }, { status: 400 })
        }
        referrerId = referrer.id
        teamA = referrer.id
        teamB = referrer.referrer || null
        teamC = referrer.teamA || null
      }

      const newUser = {
        id: Date.now(),
        username,
        phone: cleanPhone,
        password,
        referral: referral || '',
        referrer: referrerId,
        teamA,
        teamB,
        teamC,
        balance: 0,
        vip: 0,
        createdAt: new Date().toISOString()
      }

      // NEW: Save to Redis instead of memory
      await db.set(`user:${username.toLowerCase()}`, JSON.stringify(newUser))
      await db.set(`phone:${cleanPhone}`, JSON.stringify(newUser))
      
      // NEW: TEST - Read it back to prove Redis works
      const testRead = await db.get(`user:${username.toLowerCase()}`)
      const redisTestMsg = testRead ? `Redis OK: Saved ${username}` : 'Redis FAIL: Could not read back'

      return Response.json({ 
        success: true, 
        message: 'Account created successfully',
        redisTest: redisTestMsg, // NEW: send to frontend so you see it
        user: { 
          username: newUser.username, 
          phone: newUser.phone,
          name: newUser.username,
          balance: newUser.balance,
          vip: newUser.vip
        }
      })
    }

    // LOGIN  
    if (action === 'login') {
      // NEW: Get from Redis
      const user = await db.get(`phone:${cleanPhone}`)
      
      if (!user || user.password !== password) {
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