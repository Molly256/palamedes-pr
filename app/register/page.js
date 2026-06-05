'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function Register() {
  const [form, setForm] = useState({ 
    username: '',
    phone: '', 
    password: '',
    confirmPassword: '',
    referral: '' 
  })
  const [showPass, setShowPass] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Reusable styles - all boxes same size now
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
    
    if (form.username.length < 6) {
      setError('Username must be 6 letters of any name choice')
      return
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    setError('')
    setLoading(true)
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          username: form.username,
          phone: form.phone,
          password: form.password,
          referral: form.referral
        })
      })

      const data = await res.json()
      alert(data.message)
      
      if (data.success) {
        window.location.href = '/login'
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
          Register
        </h2>

        {error && <p style={{ color: 'red', fontSize: '14px', marginBottom: '15px', padding: '10px', background: '#ffe6e6', borderRadius: '6px' }}>{error}</p>}

        {/* Username */}
        <div style={formGroupStyle}>
          <label style={labelStyle}>Username</label>
          <input 
            type="text"
            required
            minLength={6}
            value={form.username}
            onChange={(e) => setForm({...form, username: e.target.value})}
            placeholder="Enter any name"
            style={inputStyle}
          />
          <p style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginBottom: 0 }}>
            must be 6 letters of any name choice
          </p>
        </div>

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

        {/* Repeat Password */}
        <div style={formGroupStyle}>
          <label style={labelStyle}>Repeat Password</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showConfirm ? 'text' : 'password'}
              required
              value={form.confirmPassword}
              onChange={(e) => setForm({...form, confirmPassword: e.target.value})}
              style={{...inputStyle, paddingRight: '50px'}}
            />
            <button 
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
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
              {showConfirm ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        {/* Referral */}
        <div style={formGroupStyle}>
          <label style={labelStyle}>Referral Code</label>
          <input 
            type="text"
            value={form.referral}
            onChange={(e) => setForm({...form, referral: e.target.value})}
            placeholder="Enter username of person who referred you"
            style={inputStyle}
          />
        </div>

        {/* Cute Register Button - not too long */}
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
            marginTop: '10px',
            opacity: loading ? 0.7 : 1,
            transition: 'transform 0.2s',
            boxShadow: '0 4px 15px rgba(0,191,255,0.3)'
          }}
          onMouseOver={(e) => !loading && (e.target.style.transform = 'scale(1.02)')}
          onMouseOut={(e) => e.target.style.transform = 'scale(1)'}
        >
          {loading ? 'Creating...' : 'Register'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '14px' }}>
          <Link href="/login" style={{ color: '#00BFFF', fontWeight: '600', textDecoration: 'none' }}>
            Already have account? Login
          </Link>
        </p>
      </form>
    </main>
  )
}