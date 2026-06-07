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

  const handleChange = (e) => {
    setForm({...form, [e.target.name]: e.target.value})
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if(form.password !== form.confirmPassword) {
      setError('Passwords do not match')
      return
    }
    if(form.password.length < 6) {
      setError('Password must be 6+ characters')
      return
    }
    
    setLoading(true)
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'register',
          username: form.username,
          phone: form.phone,
          password: form.password,
          referral: form.referral
        })
      })
      const data = await res.json()
      
      if(data.success) {
        // SAVE TO LOCALSTORAGE FOR DASHBOARD
        localStorage.setItem('palamedes_user', JSON.stringify({
          name: form.username,
          phone: form.phone,
          username: form.username,
          balance: 0,
          vip: 0
        }))
        window.location.href = '/dashboard'
      } else {
        setError(data.message || 'Registration failed')
      }
    } catch(err) {
      setError('Network error. Try again')
    }
    setLoading(false)
  }

  return (
    <main style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: '#fff',
        borderRadius: '20px',
        padding: '40px 30px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <h1 style={{textAlign: 'center', marginBottom: '8px', color: '#667eea', fontSize: '28px'}}>
          PALAMEDES PR
        </h1>
        <p style={{textAlign: 'center', color: '#666', marginBottom: '30px', fontSize: '14px'}}>
          Create your account
        </p>

        {error && (
          <div style={{
            background: '#ffe6e6',
            color: '#d32f2f',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333'}}>
              Username
            </label>
            <input
              type="text"
              name="username"
              value={form.username}
              onChange={handleChange}
              placeholder="Enter username"
              required
              minLength={3}
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid #e0e0e0',
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333'}}>
              Phone Number
            </label>
            <input
              type="tel"
              name="phone"
              value={form.phone}
              onChange={handleChange}
              placeholder="07XXXXXXXX"
              required
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid #e0e0e0',
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none'
              }}
            />
          </div>

          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333'}}>
              Password
            </label>
            <div style={{position: 'relative'}}>
              <input
                type={showPass ? 'text' : 'password'}
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Min 6 characters"
                required
                style={{
                  width: '100%',
                  padding: '14px 50px 14px 14px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '10px',
                  fontSize: '16px',
                  outline: 'none'
                }}
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
                  cursor: 'pointer',
                  fontSize: '20px'
                }}
              >
                {showPass ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div style={{marginBottom: '20px'}}>
            <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333'}}>
              Confirm Password
            </label>
            <div style={{position: 'relative'}}>
              <input
                type={showConfirm ? 'text' : 'password'}
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="Re-enter password"
                required
                style={{
                  width: '100%',
                  padding: '14px 50px 14px 14px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '10px',
                  fontSize: '16px',
                  outline: 'none'
                }}
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
                  cursor: 'pointer',
                  fontSize: '20px'
                }}
              >
                {showConfirm ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div style={{marginBottom: '25px'}}>
            <label style={{display: 'block', marginBottom: '6px', fontWeight: '600', color: '#333'}}>
              Referral Code <span style={{color: '#999', fontWeight: '400'}}>(Optional)</span>
            </label>
            <input
              type="text"
              name="referral"
              value={form.referral}
              onChange={handleChange}
              placeholder="Enter referral code"
              style={{
                width: '100%',
                padding: '14px',
                border: '2px solid #e0e0e0',
                borderRadius: '10px',
                fontSize: '16px',
                outline: 'none'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '16px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1
            }}
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>
        </form>

        <p style={{textAlign: 'center', marginTop: '20px', fontSize: '14px', color: '#666'}}>
          Already have an account?{' '}
          <Link href="/login" style={{color: '#667eea', fontWeight: '600', textDecoration: 'none'}}>
            Login
          </Link>
        </p>
      </div>
    </main>
  )
}