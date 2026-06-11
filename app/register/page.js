'use client'
import { useState, useEffect } from 'react'
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
  const [referralLocked, setReferralLocked] = useState(false)

  // Auto-fill referral from link
  useEffect(() => {
    const savedReferrer = localStorage.getItem('referrer_code') || sessionStorage.getItem('referrer_code')
    if (savedReferrer) {
      setForm(prev => ({...prev, referral: savedReferrer.trim().toUpperCase()}))
      setReferralLocked(true)
    }
  }, [])

  const handleChange = (e) => {
    if (e.target.name === 'referral' && referralLocked) return
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
          username: form.username.trim(),
          phone: form.phone.trim(),
          password: form.password,
          referral: form.referral.trim().toUpperCase()
        })
      })
      const data = await res.json()
      
      if(data.success) {
        localStorage.setItem('palamedes_user', JSON.stringify({
          name: form.username,
          phone: form.phone,
          username: form.username,
          balance: 0,
          vip: 0
        }))
        localStorage.removeItem('referrer_code')
        sessionStorage.removeItem('referrer_code')
        window.location.href = '/login'
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
      background: '#ffffff',
      padding: '40px 20px'
    }}>
      <h1 style={{textAlign: 'center', marginBottom: '20px', color: '#000', fontSize: '28px'}}>
        PALAMEDES PR
      </h1>
      <p style={{textAlign: 'center', color: '#000', marginBottom: '30px'}}>
        Create your account
      </p>

      {error && <p style={{color: 'red', textAlign: 'center', marginBottom: '20px'}}>{error}</p>}

      <form onSubmit={handleSubmit} style={{maxWidth: '400px', margin: '0 auto'}}>
        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '5px', color: '#000'}}>Username</label>
          <input
            type="text"
            name="username"
            value={form.username}
            onChange={handleChange}
            required
            minLength={6}
            style={{width: '100%', padding: '12px', border: '1px solid #ccc', background: '#fff', color: '#000'}}
          />
        </div>

        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '5px', color: '#000'}}>Phone Number</label>
          <input
            type="tel"
            name="phone"
            value={form.phone}
            onChange={handleChange}
            required
            style={{width: '100%', padding: '12px', border: '1px solid #ccc', background: '#fff', color: '#000'}}
          />
        </div>

        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '5px', color: '#000'}}>Password</label>
          <div style={{position: 'relative'}}>
            <input
              type={showPass ? 'text' : 'password'}
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              style={{width: '100%', padding: '12px', border: '1px solid #ccc', background: '#fff', color: '#000'}}
            />
            <button type="button" onClick={() => setShowPass(!showPass)} style={{position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '0'}}>
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '5px', color: '#000'}}>Confirm Password</label>
          <div style={{position: 'relative'}}>
            <input
              type={showConfirm ? 'text' : 'password'}
              name="confirmPassword"
              value={form.confirmPassword}
              onChange={handleChange}
              required
              style={{width: '100%', padding: '12px', border: '1px solid #ccc', background: '#fff', color: '#000'}}
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '0'}}>
              {showConfirm ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div style={{marginBottom: '20px'}}>
          <label style={{display: 'block', marginBottom: '5px', color: '#000'}}>
            Referral Code {referralLocked && <span style={{color: '#00BFFF', fontSize: '12px'}}>(Auto-filled)</span>}
          </label>
          <input
            type="text"
            name="referral"
            value={form.referral}
            onChange={handleChange}
            readOnly={referralLocked}
            style={{
              width: '100%', 
              padding: '12px', 
              border: '1px solid #ccc', 
              background: referralLocked ? '#f3f4f6' : '#fff', 
              color: '#000',
              cursor: referralLocked ? 'not-allowed' : 'text'
            }}
          />
        </div>

        <button 
          type="submit" 
          disabled={loading} 
          style={{
            width: '100%', 
            padding: '14px', 
            background: loading ? '#666' : '#000', 
            color: '#fff', 
            border: 'none', 
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Creating...' : 'Register'}
        </button>
      </form>

      <p style={{textAlign: 'center', marginTop: '20px'}}>
        <Link href="/login" style={{color: '#000'}}>Already have an account? Login</Link>
      </p>
    </main>
  )
}