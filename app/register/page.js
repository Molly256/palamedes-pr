'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function Register() {
  const router = useRouter()
  const lockRef = useRef(false) // <- Instant lock, no state lag

  const [form, setForm] = useState({
    username: '',
    phone: '',
    password: '',
    repeatPassword: '',
    inviteCode: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showRepeatPassword, setShowRepeatPassword] = useState(false)

  const handlePhoneChange = (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10)
    const inviteCode = /^07\d{8}$/.test(cleaned) ? `PM${cleaned.slice(-6)}` : ''
    setForm(prev => ({ ...prev, phone: cleaned, inviteCode }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (lockRef.current) return // <- Block double tap instantly
    lockRef.current = true

    // Validation
    if (!/^[a-zA-Z0-9]{6}$/.test(form.username)) {
      alert('Username must be 6 letters and numbers combined')
      lockRef.current = false
      return
    }
    if (!/^07\d{8}$/.test(form.phone)) {
      alert('Phone must start with 07 and be 10 digits')
      lockRef.current = false
      return
    }
    if (!/^[a-zA-Z0-9]{6}$/.test(form.password)) {
      alert('Password must be 6 letters and numbers')
      lockRef.current = false
      return
    }
    if (form.password !== form.repeatPassword) {
      alert('Passwords do not match')
      lockRef.current = false
      return
    }

    try {
      // FIXED: We now await the network response instead of skipping ahead immediately
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          username: form.username,
          phone: form.phone,
          password: form.password
        })
      })

      const data = await response.json()

      if (data.success) {
        // FIXED: Construct a localized temporary storage object matching your invite lookup key
        const userSession = {
          username: form.username,
          phone: form.phone,
          inviteCode: data.inviteCode // 👈 Takes the live registered key from the server
        }

        // FIXED: Write it to local storage right now so the invite system displays it
        localStorage.setItem('palamedes_user', JSON.stringify(userSession))

        // Redirect to login only after data is securely cached
        router.push('/login')
      } else {
        alert(data.error || 'Registration failed')
        lockRef.current = false
      }
    } catch (err) {
      console.error('Register error:', err)
      alert('A network connection error occurred. Please try again.')
      lockRef.current = false
    }
  }

  const inputStyle = {
    width: '100%',
    height: '44px', // <- Same height for all
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    padding: '0 12px',
    fontSize: '16px',
    color: '#000',
    backgroundColor: '#fff',
    outline: 'none',
    boxSizing: 'border-box'
  }

  return (
    <div style={{ minHeight: '100vh', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: '900', textAlign: 'center', marginBottom: '24px', color: '#000' }}>Register</h1>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div>
            <label style={{ fontSize: '15px', color: '#000', display: 'block', marginBottom: '6px', fontWeight: '700' }}>Username</label>
            <input
              type="text"
              placeholder="6 letters/numbers"
              value={form.username}
              onChange={(e) => setForm(prev => ({ ...prev, username: e.target.value }))}
              maxLength={6}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '15px', color: '#000', display: 'block', marginBottom: '6px', fontWeight: '700' }}>Phone Number</label>
            <input
              type="tel"
              placeholder="07XXXXXXXX"
              value={form.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              maxLength={10}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={{ fontSize: '15px', color: '#000', display: 'block', marginBottom: '6px', fontWeight: '700' }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="6 letters/numbers"
                value={form.password}
                onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                maxLength={6}
                style={{...inputStyle, paddingRight: '44px'}}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                👁️
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '15px', color: '#000', display: 'block', marginBottom: '6px', fontWeight: '700' }}>Repeat Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showRepeatPassword ? 'text' : 'password'}
                placeholder="Repeat password"
                value={form.repeatPassword}
                onChange={(e) => setForm(prev => ({ ...prev, repeatPassword: e.target.value }))}
                maxLength={6}
                style={{...inputStyle, paddingRight: '44px'}}
                required
              />
              <button
                type="button"
                onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '18px', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                👁️
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: '15px', color: '#000', display: 'block', marginBottom: '6px', fontWeight: '700' }}>Invite Code</label>
            <input
              type="text"
              value={form.inviteCode}
              readOnly
              placeholder="Auto generated after phone"
              style={{...inputStyle, backgroundColor: '#f3f4f6', color: '#6b7280'}}
            />
          </div>

          <button
            type="submit"
            style={{ 
              width: '100%',
              height: '44px',
              borderRadius: '8px',
              border: 'none',
              backgroundColor: '#87CEEB',
              color: '#000',
              fontWeight: '500',
              fontSize: '16px',
              cursor: 'pointer',
              marginTop: '4px'
            }}
          >
            Register
          </button>
        </form>
        
        <p style={{ textAlign: 'center', fontSize: '15px', color: '#000', marginTop: '16px' }}>
          Already have an account? <a href="/login" style={{ color: '#00BFFF', textDecoration: 'underline', fontWeight: '700' }}>Login</a>
        </p>
      </div>
    </div>
  )
}