'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Login() {
  const router = useRouter()
  const [form, setForm] = useState({ phone: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handlePhoneChange = (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10)
    // FIX: functional update so we never use stale form
    setForm(prev => ({ ...prev, phone: cleaned }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!/^07\d{8}$/.test(form.phone)) {
      alert('Phone must start with 07 and be 10 digits')
      return
    }
    if (!form.password) {
      alert('Enter your password')
      return
    }

    setLoading(true)
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'login', 
          phone: form.phone, // <- Now always 07XXXXXXXX
          password: form.password 
        })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error)
        return
      }

      localStorage.setItem('palamedes_user', JSON.stringify(data.user))

      if (data.user.phone === '0753520252') {
        router.push('/admin')
      } else {
        router.push('/dashboard')
      }
      
    } catch (err) {
      alert('Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6 text-black">Login</h1>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-black block mb-1">Phone Number</label>
            <input
              type="tel"
              placeholder="07XXXXXXXX"
              value={form.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              maxLength={10}
              className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div>
            <label className="text-sm text-black block mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={form.password}
                onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))} // <- FIXED
                maxLength={6}
                className="w-full border-gray-300 rounded px-3 py-2 pr-10 text-black bg-white focus:outline-none focus:border-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xl"
              >
                👁️
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded font-medium disabled:opacity-50"
            style={{ backgroundColor: '#87CEEB', color: '#333' }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <p className="text-center text-sm text-black mt-4">
          Don't have an account? <a href="/register" className="text-blue-600 underline">Register</a>
        </p>
      </div>
    </div>
  )
}