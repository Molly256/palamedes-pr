'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function Login() {
  const [form, setForm] = useState({ phone: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Same styles as register - all boxes same size
  const inputStyle = {
    width: '100%',
    maxWidth: '400px',
    height: '48px',
    padding: '0 16px',
    border: '2px solid #d0d0d0',
    borderRadius: '10px',
    fontSize: '16px',
    color: '#000',
    background: '#fff',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border 0.2s'
  }

  const labelStyle = {
    display: 'block',
    color: '#333',
    fontWeight: '600',
    marginBottom: '6px',
    fontSize: '14px'
  }

  const formGroupStyle = {
    marginBottom: '18px',
    width: '100%',
    maxWidth: '400px'
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    
    try {
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
      alert(data.message)
      
      if (data.success) {
        localStorage.setItem('palamedes_user', JSON.stringify(data.user))
        window.location.href = '/dashboard'
      }
    } catch (err) {
      alert('Network error. Try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ 
      minHeight: '100vh', 
      background: '#f8f9fa', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '40px 20px' 
    }}>
      <form onSubmit={handleSubmit} style={{ 
        width: '100%', 
        maxWidth: '420px',
        background: '#fff',
        padding: '40px 32px',
        borderRadius: '16px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.08)'
      }}>
        
        <p style={{ textAlign: 'center', fontSize: '16px', color: '#666', marginBottom: '4px' }}>
          welcome to
        </p>

        <h1 style={{ textAlign: 'center', fontSize: '32px', fontWeight: '900', color: '#87CEEB', marginBottom: '32px', letterSpacing: '1px' }}>
          PALAMEDES PR
        </h1>

        <h2 style={{ color: '#000', fontSize: '24px', fontWeight: '700', marginBottom: '24px' }}>
          Login
        </h2>

        {error && <p style={{ color: 'red', fontSize: '14px', marginBottom: '15px', padding: '10px', background: '#ffe6e6', borderRadius: '6px' }}>{error}</p>}

        {/* Phone */}
        <div style={formGroupStyle}>
          <label style={labelStyle}>Phone Number</label>
          <input 
            type="tel"
            required
            value={form.phone}
            onChange={(e) => setForm({...form, phone: e.target.value})}
            placeholder="07XXXXXXXXX"
            style={inputStyle}
          />
        </div>

        {/* Password */}
        <div style={formGroupStyle}>
          <label style={labelStyle}>Password</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showPass ? 'text' : 'password'}
              required
              value={form.password}
              onChange={(e) => setForm({...form, password: e.target.value})}
              style={{...inputStyle, paddingRight: '50px'}}
            />
            <button 
              type="button"
              onClick={() => setShowPass(!showPass)}
              style={{ 
                position: 'absolute', 
                right: '12px', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                background: 'none', 
                border: 'none', 
                fontSize: '20px', 
                cursor: 'pointer' 
              }}
            >
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'right', marginBottom: '24px', marginTop: '8px' }}>
          <Link href="/register" style={{ color: '#00BFFF', fontWeight: '600', fontSize: '14px', textDecoration: 'none' }}>
            No account? Register
          </Link>
        </p>

        {/* Cute Login Button - pill shape */}
        <button 
          type="submit" 
          disabled={loading} 
          style={{
            width: '100%',
            maxWidth: '400px',
            height: '50px',
            background: 'linear-gradient(135deg, #87CEEB 0%, #00BFFF 100%)',
            color: 'white', 
            border: 'none', 
            borderRadius: '50px', 
            fontSize: '16px', 
            fontWeight: '700',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
            transition: 'transform 0.2s',
            boxShadow: '0 4px 15px rgba(0,191,255,0.3)'
          }}
          onMouseOver={(e) => !loading && (e.target.style.transform = 'scale(1.02)')}
          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </main>
  )
}