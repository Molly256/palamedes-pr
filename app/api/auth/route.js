import { db } from '../redis.js' // Fixed path

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

      const existingUser = await db.get(`user:${username.toLowerCase()}`)
      if (existingUser) {
        return Response.json({ success: false, message: 'Username already taken' }, { status: 400 })
      }

      const existingPhone = await db.get(`phone:${cleanPhone}`)
      if (existingPhone) {
        return Response.json({ success: false, message: 'Phone number already registered' }, { status: 400 })
      }

      let referrerId = null
      let teamA = null
      let teamB = null
      let teamC = null

      if (referral && referral.trim() !== '') {
        const referrerStr = await db.get(`user:${referral.toLowerCase()}`)
        if (!referrerStr) {
          return Response.json({ success: false, message: 'Invalid referral code' }, { status: 400 })
        }
        const referrer = JSON.parse(referrerStr) // Parse Redis string to object
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

      await db.set(`user:${username.toLowerCase()}`, JSON.stringify(newUser))
      await db.set(`phone:${cleanPhone}`, JSON.stringify(newUser))
      
      const testRead = await db.get(`user:${username.toLowerCase()}`)
      const redisTestMsg = testRead ? `Redis OK: Saved ${username}` : 'Redis FAIL: Could not read back'

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

    // LOGIN  
    if (action === 'login') {
      const userStr = await db.get(`phone:${cleanPhone}`)
      
      if (!userStr) {
        return Response.json({ success: false, message: 'Invalid phone or password' }, { status: 401 })
      }
      
      const user = JSON.parse(userStr) // Parse Redis string to object
      
      if (user.password !== password) {
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