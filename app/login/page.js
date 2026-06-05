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
        // Save user data to localStorage for dashboard
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
          Login
        </h2>

        {error && <p style={{ color: 'red', fontSize: '14px', marginBottom: '15px' }}>{error}</p>}

        <label style={{ display: 'block', color: '#000', fontWeight: '600', marginBottom: '8px', fontSize: '16px' }}>
          Phone Number
        </label>
        <input 
          type="text"
          required
          value={form.phone}
          onChange={(e) => setForm({...form, phone: e.target.value})}
          placeholder="Enter exact number you registered"
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
        <div style={{ position: 'relative', marginBottom: '10px' }}>
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

        <p style={{ textAlign: 'right', marginBottom: '30px' }}>
          <Link href="/register" style={{ color: '#87CEEB', fontWeight: '600', fontSize: '14px' }}>
            No account? Register
          </Link>
        </p>

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
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </main>
  )
}