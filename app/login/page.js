// LOGIN - DEBUG VERSION
if (action === 'login') {
  if (!phoneKey) {
    return Response.json({ success: false, message: 'Phone number required' }, { status: 400 })
  }

  console.log('Login trying key:', phoneKey) // Add this
  console.log('Login password entered:', password) // Add this

  const user = await db.hgetall(phoneKey)
  console.log('KV returned user:', user) // Add this
  
  if (!user || !user.username || Object.keys(user).length === 0) {
    return Response.json({ success: false, message: 'Phone not registered. Key: ' + phoneKey }, { status: 401 })
  }
  
  if (user.password !== password.trim()) {
    return Response.json({ 
      success: false, 
      message: 'Password mismatch. Saved:' + user.password + ' Entered:' + password.trim() 
    }, { status: 401 })
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