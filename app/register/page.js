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
        // Save for Dashboard
        localStorage.setItem('palamedes_user', JSON.stringify({
          name: form.username,
          phone: form.phone,
          username: form.username,
          balance: 0,
          vip: 0
        }))
        window.location.href = '/login' // Changed: go to login not dashboard
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
      background: '#ffffff', // Changed: full white
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
            minLength={3}
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
              style={{width: '100%', padding: '12px 40px 12px 12px', border: '1px solid #ccc', background: '#fff', color: '#000'}}
            />
            <button type="button" onClick={() => setShowPass(!showPass)} style={{position: 'absolute', right: '10px', top: '12px', background: 'none', border: 'none', cursor: 'pointer'}}>
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
              style={{width: '100%', padding: '12px 40px 12px 12px', border: '1px solid #ccc', background: '#fff', color: '#000'}}
            />
            <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{position: 'absolute', right: '10px', top: '12px', background: 'none', border: 'none', cursor: 'pointer'}}>
              {showConfirm ? '🙈' : '👁️'}
            </button>
          </div>
        </div>

        <div style={{marginBottom: '20px'}}>
          <label style={{display: 'block', marginBottom: '5px', color: '#000'}}>Referral Code (Optional)</label>
          <input
            type="text"
            name="referral"
            value={form.referral}
            onChange={handleChange}
            style={{width: '100%', padding: '12px', border: '1px solid #ccc', background: '#fff', color: '#000'}}
          />
        </div>

        <button type="submit" disabled={loading} style={{width: '100%', padding: '14px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer'}}>
          {loading ? 'Creating...' : 'Register'}
        </button>
      </form>

      <p style={{textAlign: 'center', marginTop: '20px'}}>
        <Link href="/login" style={{color: '#000'}}>Already have an account? Login</Link>
      </p>
    </main>
  )
}