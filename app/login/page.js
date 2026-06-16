'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function Login() {
  const [form, setForm] = useState({ phone: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    
    if (!/^07\d{8}$/.test(form.phone)) {
      setError('Phone must be 10 digits starting with 07')
      return
    }

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
      
      if (data.success && data.user) {
        localStorage.setItem('palamedes_user', JSON.stringify({
          name: data.user.name || data.user.username,
          username: data.user.username,
          phone: data.user.phone,
          balance: data.user.balance || 0,
          vip: data.user.vip || 0,
          avatar: data.user.avatar || ''
        }))
        window.location.href = '/dashboard'
      } else {
        setError(data.message || 'Invalid phone or password')
      }
    } catch (err) {
      setError('Network error. Try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#ffffff', padding: '40px 20px' }}>
      <h1 style={{ textAlign: 'center', fontSize: '28px', color: '#000', marginBottom: '20px' }}>PALAMEDES PR</h1>
      <h2 style={{ color: '#000', fontSize: '24px', textAlign: 'center', marginBottom: '30px' }}>Login</h2>
      {error && <p style={{ color: 'red', textAlign: 'center', marginBottom: '20px' }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ maxWidth: '400px', margin: '0 auto' }}>
        <div style={{marginBottom: '15px'}}>
          <label style={{display: 'block', marginBottom: '5px', color: '#000'}}>Phone Number</label>
          <input 
            type="tel" 
            required 
            value={form.phone} 
            onChange={(e) => setForm({...form, phone: e.target.value})} 
            pattern="07[0-9]{8}"
            minLength={10}
            maxLength={10}
            placeholder="07xxxxxxxx" 
            title="Enter 10 digits starting with 07"
            style={{width: '100%', padding: '12px', border: '1px solid #ccc', background: '#fff', color: '#000'}}
          />
        </div>
        <div style={{marginBottom: '20px'}}>
          <label style={{display: 'block', marginBottom: '5px', color: '#000'}}>Password</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showPass ? 'text' : 'password'} 
              required 
              value={form.password} 
              onChange={(e) => setForm({...form, password: e.target.value})} 
              style={{width: '100%', padding: '12px', border: '1px solid #ccc', background: '#fff', color: '#000'}}
            />
            <button 
              type="button" 
              onClick={() => setShowPass(!showPass)} 
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '0' }}
            >
              {showPass ? '🙈' : '👁️'}
            </button>
          </div>
        </div>
        <p style={{ textAlign: 'right', marginBottom: '20px' }}>
          <Link href="/register" style={{ color: '#000' }}>No account? Register</Link>
        </p>
        <button 
          type="submit" 
          disabled={loading} 
          style={{width: '100%', padding: '14px', background: loading ? '#666' : '#000', color: '#fff', border: 'none', cursor: loading ? 'not-allowed' : 'pointer'}}
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </main>
  )
}