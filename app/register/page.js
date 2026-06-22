'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Register() {
  const router = useRouter()
  const [form, setForm] = useState({
    username: '',
    phone: '',
    password: '',
    repeatPassword: '',
    inviteCode: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showRepeatPassword, setShowRepeatPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handlePhoneChange = (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 10)
    setForm({ ...form, phone: cleaned })
    
    if (/^07\d{8}$/.test(cleaned)) {
      setForm(prev => ({ ...prev, phone: cleaned, inviteCode: `PM${cleaned.slice(-6)}` }))
    } else {
      setForm(prev => ({ ...prev, phone: cleaned, inviteCode: '' }))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    // Validation
    if (!/^[a-zA-Z0-9]{6}$/.test(form.username)) {
      alert('Username must be 6 letters and numbers combined')
      return
    }
    if (!/^07\d{8}$/.test(form.phone)) {
      alert('Phone must start with 07 and be 10 digits')
      return
    }
    if (!/^[a-zA-Z0-9]{6}$/.test(form.password)) {
      alert('Password must be 6 letters and numbers')
      return
    }
    if (form.password !== form.repeatPassword) {
      alert('Passwords do not match')
      return
    }

    setLoading(true)
    
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register',
          username: form.username,
          phone: form.phone,
          password: form.password
        })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error)
        setLoading(false)
        return
      }

      alert('Registered successfully! Your invite code: ' + data.inviteCode)
      router.push('/login')
      
    } catch (err) {
      alert('Something went wrong. Try again.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-3xl font-bold text-center mb-6 text-black">Register</h1>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          
          {/* Username */}
          <div>
            <label className="text-base text-black block mb-1">Username</label>
            <input
              type="text"
              placeholder="6 letters/numbers"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              maxLength={6}
              className="w-full border-gray-300 rounded px-3 py-2 text-base text-black bg-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {/* Phone */}
          <div>
            <label className="text-base text-black block mb-1">Phone Number</label>
            <input
              type="tel"
              placeholder="07XXXXXXXX"
              value={form.phone}
              onChange={(e) => handlePhoneChange(e.target.value)}
              maxLength={10}
              className="w-full border-gray-300 rounded px-3 py-2 text-base text-black bg-white focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-base text-black block mb-1">Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="6 letters/numbers"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                maxLength={6}
                className="w-full border-gray-300 rounded px-3 py-2 pr-10 text-base text-black bg-white focus:outline-none focus:border-blue-500"
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

          {/* Repeat Password */}
          <div>
            <label className="text-base text-black block mb-1">Repeat Password</label>
            <div className="relative">
              <input
                type={showRepeatPassword ? 'text' : 'password'}
                placeholder="Repeat password"
                value={form.repeatPassword}
                onChange={(e) => setForm({ ...form, repeatPassword: e.target.value })}
                maxLength={6}
                className="w-full border-gray-300 rounded px-3 py-2 pr-10 text-base text-black bg-white focus:outline-none focus:border-blue-500"
                required
              />
              <button
                type="button"
                onClick={() => setShowRepeatPassword(!showRepeatPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xl"
              >
                👁️
              </button>
            </div>
          </div>

          {/* Invite Code - auto filled */}
          <div>
            <label className="text-base text-black block mb-1">Invite Code</label>
            <input
              type="text"
              value={form.inviteCode}
              readOnly
              placeholder="Auto generated after phone"
              className="w-full border-gray-300 rounded px-3 py-2 text-base text-gray-600 bg-gray-100"
            />
          </div>

          {/* Register Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded font-medium text-base"
            style={{ 
              backgroundColor: '#87CEEB', 
              color: '#333' 
            }}
          >
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>
        
        <p className="text-center text-base text-black mt-4">
          Already have an account? <a href="/login" className="text-blue-600 underline">Login</a>
        </p>
      </div>
    </div>
  )
}