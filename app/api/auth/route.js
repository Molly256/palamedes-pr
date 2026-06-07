// Fake DB for testing. Resets on server restart
let users = []

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

      const userExists = users.find(u => u.username.toLowerCase() === username.toLowerCase())
      if (userExists) {
        return Response.json({ success: false, message: 'Username already taken' }, { status: 400 })
      }

      const phoneExists = users.find(u => u.phone === cleanPhone)
      if (phoneExists) {
        return Response.json({ success: false, message: 'Phone number already registered' }, { status: 400 })
      }

      // NEW: Validate referral and build team chain
      let referrerId = null
      let teamA = null // Direct referrer - 5%
      let teamB = null // Referrer's referrer - 2%
      let teamC = null // Referrer's referrer's referrer - 1%

      if (referral && referral.trim() !== '') {
        const referrer = users.find(u => u.username.toLowerCase() === referral.toLowerCase())
        if (!referrer) {
          return Response.json({ success: false, message: 'Invalid referral code' }, { status: 400 })
        }
        referrerId = referrer.id
        teamA = referrer.id
        teamB = referrer.referrer || null
        teamC = referrer.teamA || null // TeamB's TeamA = TeamC
      }

      const newUser = {
        id: Date.now(),
        username,
        phone: cleanPhone,
        password,
        referral: referral || '',
        referrer: referrerId, // NEW: stores who referred this user
        teamA, // NEW: Level 1 - 5% commission
        teamB, // NEW: Level 2 - 2% commission  
        teamC, // NEW: Level 3 - 1% commission
        balance: 0,
        vip: 0, // NEW: track VIP level
        createdAt: new Date().toISOString()
      }
      users.push(newUser)

      return Response.json({ 
        success: true, 
        message: 'Account created successfully',
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
      const user = users.find(u => u.phone === cleanPhone)
      
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
    return Response.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}