'use client'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const router = useRouter()
  const lockRef = useRef(false) // <- Instant lock, no state lag

  const [form, setForm] = useState({ phone: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)

  const handlePhoneChange = (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10)
    setForm(prev => ({ ...prev, phone: cleaned }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (lockRef.current) return
    lockRef.current = true

    if (!/^07\d{8}$/.test(form.phone)) {
      alert('Phone must start with 07 and be 10 digits')
      lockRef.current = false
      return
    }
    if (!form.password) {
      alert('Enter your password')
      lockRef.current = false
      return
    }

    try {
      // 1. AWAIT REAL REDIS DATA = No fake login
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'login', 
          phone: form.phone,
          password: form.password 
        })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Authentication failed')
        lockRef.current = false // <- Clear lock so user can try retyping password
        return
      }

      // FIXED: Safely verify that user data exists before committing to LocalStorage
      if (data && data.user) {
        localStorage.setItem('palamedes_user', JSON.stringify(data.user))

        // 2. GO INSTANTLY after we have real data verified
        if (data.user.phone === '0753520252') {
          router.push('/admin')
        } else {
          router.push('/dashboard')
        }
      } else {
        alert('Server returned an incomplete user session. Please try again.')
        lockRef.current = false
      }
      
    } catch (err) {
      console.error('Login submit error:', err)
      alert('Something went wrong. Check connection and try again.')
      lockRef.current = false // <- Always release lock on network failure
    }
  }

  const inputStyle = {
    width: '100%',
    height: '44px', // <- Same height as Register
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
        <h1 style={{ fontSize: '28px', fontWeight: '900', textAlign: 'center', marginBottom: '24px', color: '#000' }}>Login</h1>
        
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                placeholder="Enter password"
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
            Login
          </button>
        </form>
        
        <p style={{ textAlign: 'center', fontSize: '15px', color: '#000', marginTop: '16px' }}>
          Don't have an account? <a href="/register" style={{ color: '#00BFFF', textDecoration: 'underline', fontWeight: '700' }}>Register</a>
        </p>
      </div>
    </div>
  )
}