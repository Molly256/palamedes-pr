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
      background: '#fff', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '40px 20px' 
    }}>
      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '420px' }}>
        
        <p style={{ textAlign: 'center', fontSize: '20px', color: '#000', marginBottom: '5px', fontWeight: '500' }}>
          welcome to
        </p>

        <h1 style={{ textAlign: 'center', fontSize: '38px', fontWeight: '900', color: '#87CEEB', marginBottom: '40px', letterSpacing: '2px' }}>
          PALAMEDES PR
        </h1>

        <h2 style={{ color: '#000', fontSize: '24px', fontWeight: '700', marginBottom: '30px' }}>
          Register
        </h2>

        {error && <p style={{ color: 'red', fontSize: '14px', marginBottom: '15px' }}>{error}</p>}

        <label style={{ display: 'block', color: '#000', fontWeight: '600', marginBottom: '8px', fontSize: '16px' }}>
          Username
        </label>
        <input 
          type="text"
          required
          minLength={6}
          value={form.username}
          onChange={(e) => setForm({...form, username: e.target.value})}
          placeholder="Enter any name"
          style={{ 
            width: '100%', 
            padding: '14px', 
            marginBottom: '5px', 
            border: '2px solid #000', 
            borderRadius: '6px', 
            fontSize: '16px',
            color: '#000',
            background: '#fff'
          }}
        />
        <p style={{ fontSize: '12px', color: '#666', marginBottom: '20px' }}>
          must be 6 letters of any name choice
        </p>

        <label style={{ display: 'block', color: '#000', fontWeight: '600', marginBottom: '8px', fontSize: '16px' }}>
          Phone Number
        </label>
        <input 
          type="text"
          required
          value={form.phone}
          onChange={(e) => setForm({...form, phone: e.target.value})}
          placeholder="07XXXXXXXX"
          style={{ 
            width: '100%', 
            padding: '14px', 
            marginBottom: '20px', 
            border: '2px solid #000', 
            borderRadius: '6px', 
            fontSize: '16px',
            color: '#000',
            background: '#fff'
          }}
        />

        <label style={{ display: 'block', color: '#000', fontWeight: '600', marginBottom: '8px', fontSize: '16px' }}>
          Password
        </label>
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <input 
            type={showPass ? 'text' : 'password'}
            required
            value={form.password}
            onChange={(e) => setForm({...form, password: e.target.value})}
            style={{ 
              width: '100%', 
              padding: '14px 50px 14px 14px', 
              border: '2px solid #000', 
              borderRadius: '6px', 
              fontSize: '16px',
              color: '#000',
              background: '#fff'
            }}
          />
          <button 
            type="button"
            onClick={() => setShowPass(!showPass)}
            style={{ 
              position: 'absolute', 
              right: '14px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              background: 'none', 
              border: 'none', 
              fontSize: '22px', 
              cursor: 'pointer' 
            }}
          >
            {showPass ? '🙈' : '👁️'}
          </button>
        </div>

        <label style={{ display: 'block', color: '#000', fontWeight: '600', marginBottom: '8px', fontSize: '16px' }}>
          Repeat Password
        </label>
        <div style={{ position: 'relative', marginBottom: '20px' }}>
          <input 
            type={showConfirm ? 'text' : 'password'}
            required
            value={form.confirmPassword}
            onChange={(e) => setForm({...form, confirmPassword: e.target.value})}
            style={{ 
              width: '100%', 
              padding: '14px 50px 14px 14px', 
              border: '2px solid #000', 
              borderRadius: '6px', 
              fontSize: '16px',
              color: '#000',
              background: '#fff'
            }}
          />
          <button 
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            style={{ 
              position: 'absolute', 
              right: '14px', 
              top: '50%', 
              transform: 'translateY(-50%)', 
              background: 'none', 
              border: 'none', 
              fontSize: '22px', 
              cursor: 'pointer' 
            }}
          >
            {showConfirm ? '🙈' : '👁️'}
          </button>
        </div>

        <label style={{ display: 'block', color: '#000', fontWeight: '600', marginBottom: '8px', fontSize: '16px' }}>
          Referral Code
        </label>
        <input 
          type="text"
          value={form.referral}
          onChange={(e) => setForm({...form, referral: e.target.value})}
          placeholder="Enter username of person who referred you"
          style={{ 
            width: '100%', 
            padding: '14px', 
            marginBottom: '30px', 
            border: '2px solid #000', 
            borderRadius: '6px', 
            fontSize: '16px',
            color: '#000',
            background: '#fff'
          }}
        />

        <button type="submit" disabled={loading} style={{
          width: '100%', 
          padding: '16px', 
          background: '#87CEEB',
          color: '#000', 
          border: 'none', 
          borderRadius: '6px', 
          fontSize: '18px', 
          fontWeight: '600',
          cursor: loading ? 'not-allowed' : 'pointer',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          opacity: loading ? 0.7 : 1
        }}>
          {loading ? 'Creating...' : 'Create Account'}
        </button>

        <p style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link href="/login" style={{ color: '#87CEEB', fontWeight: '600', fontSize: '14px' }}>
            Already have account? Login
          </Link>
        </p>
      </form>
    </main>
  )
}