// Fake DB for testing. Resets on server restart
let users = []

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, username, phone, password, referral } = body

    // REGISTER
    if (action === 'register') {
      if (!username || username.length < 6) {
        return Response.json({ success: false, message: 'Username must be 6 letters minimum' }, { status: 400 })
      }

      const userExists = users.find(u => u.username.toLowerCase() === username.toLowerCase())
      if (userExists) {
        return Response.json({ success: false, message: 'Username already taken' }, { status: 400 })
      }

      const phoneExists = users.find(u => u.phone === phone)
      if (phoneExists) {
        return Response.json({ success: false, message: 'Phone number already registered' }, { status: 400 })
      }

      if (referral && referral.trim() !== '') {
        const referrer = users.find(u => u.username.toLowerCase() === referral.toLowerCase())
        if (!referrer) {
          return Response.json({ success: false, message: 'Invalid referral code' }, { status: 400 })
        }
      }

      const newUser = {
        id: Date.now(),
        username,
        phone, // keep phone in DB
        password,
        referral: referral || '',
        balance: 0,
        createdAt: new Date().toISOString()
      }
      users.push(newUser)

      return Response.json({ 
        success: true, 
        message: 'Account created successfully',
        user: { 
          username: newUser.username, 
          phone: newUser.phone, // Changed: phone not number
          name: newUser.username, // Added: name for Dashboard
          balance: newUser.balance 
        }
      })
    }

    // LOGIN  
    if (action === 'login') {
      const user = users.find(u => u.phone === phone)
      
      if (!user || user.password !== password) {
        return Response.json({ success: false, message: 'Invalid phone or password' }, { status: 401 })
      }

      return Response.json({ 
        success: true, 
        message: 'Login successful',
        user: { 
          username: user.username, 
          phone: user.phone, // Changed: phone not number
          name: user.username, // Added: name for Dashboard
          balance: user.balance 
        }
      })
    }

    return Response.json({ success: false, message: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error(err)
    return Response.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}