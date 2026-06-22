'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Admin() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Password reset state
  const [searchPhone, setSearchPhone] = useState('')
  const [foundUser, setFoundUser] = useState(null)
  const [showResetBox, setShowResetBox] = useState(false)
  const [tempPassword, setTempPassword] = useState('')

  const ADMIN_PHONE = '0753520252'

  useEffect(() => {
    const localUser = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (localUser.phone !== ADMIN_PHONE) {
      router.push('/dashboard')
      return
    }
    setUser(localUser)
    loadPending()
  }, [])

  const loadPending = async () => {
    const res = await fetch('/api/admin?action=pending')
    const data = await res.json()
    if (data.success) setPending(data.pending)
    setLoading(false)
  }

  const handleAction = async (id, action) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateStatus', id, status: action })
    })
    const data = await res.json()
    if (data.success) {
      alert(`Transaction ${action}`)
      loadPending()
    } else {
      alert(data.error)
    }
  }

  const searchUser = async () => {
    if (!/^07\d{8}$/.test(searchPhone)) {
      alert('Enter valid phone')
      return
    }
    const res = await fetch(`/api/admin?action=user&phone=${searchPhone}`)
    const data = await res.json()
    if (data.success) {
      setFoundUser(data.user)
    } else {
      alert('User not found')
      setFoundUser(null)
    }
  }

  const resetPassword = async () => {
    if (!/^[a-zA-Z0-9]{6}$/.test(tempPassword)) {
      alert('Password must be 6 letters/numbers')
      return
    }
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resetPassword', phone: searchPhone, password: tempPassword })
    })
    const data = await res.json()
    if (data.success) {
      alert('Password reset. Tell user to login with: ' + tempPassword)
      setShowResetBox(false)
      setTempPassword('')
    } else {
      alert(data.error)
    }
  }

  if (!user) return <div className="p-4 text-black">Loading...</div>

  return (
    <div className="min-h-screen bg-white p-4">
      <h1 className="text-2xl font-bold text-black mb-6">Admin Panel</h1>

      {/* Section 1: Pending Transactions */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-black mb-3">Pending Transactions</h2>
        {loading ? (
          <p className="text-black">Loading...</p>
        ) : pending.length === 0 ? (
          <p className="text-gray-600">No pending transactions</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map(tx => (
              <div key={tx.id} className="border border-gray-300 rounded p-3 bg-gray-50">
                <p className="text-black font-bold">{tx.type.toUpperCase()} - {tx.amount} shs</p>
                <p className="text-black">Phone: {tx.phone}</p>
                <p className="text-black">Method: {tx.method}</p>
                <p className="text-gray-600 text-sm">{new Date(tx.createdAt).toLocaleString()}</p>
                <div className="flex gap-2 mt-2">
                  <button 
                    onClick={() => handleAction(tx.id, 'success')}
                    className="px-4 py-1 bg-green-500 text-white rounded font-bold"
                  >
                    Approve
                  </button>
                  <button 
                    onClick={() => handleAction(tx.id, 'failed')}
                    className="px-4 py-1 bg-red-500 text-white rounded font-bold"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Password Reset */}
      <div>
        <h2 className="text-xl font-bold text-black mb-3">Password Reset</h2>
        <div className="flex gap-2 mb-3">
          <input
            type="tel"
            placeholder="07XXXXXXXX"
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
            maxLength={10}
            className="flex-1 border-gray-300 rounded px-3 py-2 text-black bg-white"
          />
          <button 
            onClick={searchUser}
            className="px-4 py-2 bg-blue-500 text-white rounded"
          >
            🔍
          </button>
        </div>

        {foundUser && (
          <div className="border border-gray-300 rounded p-3 bg-gray-50">
            <p className="text-black"><b>Username:</b> {foundUser.username}</p>
            <p className="text-black"><b>Phone:</b> {foundUser.phone}</p>
            <p className="text-black"><b>Password:</b> {foundUser.password}</p>
            <button 
              onClick={() => setShowResetBox(true)}
              className="mt-2 px-4 py-1 bg-yellow-500 text-black rounded font-bold"
            >
              Reset Password
            </button>

            {showResetBox && (
              <div className="mt-3 p-3 bg-white border-gray-300 rounded">
                <input
                  type="text"
                  placeholder="New temp password 6 chars"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  maxLength={6}
                  className="w-full border-gray-300 rounded px-3 py-2 text-black mb-2"
                />
                <button 
                  onClick={resetPassword}
                  className="px-4 py-1 bg-green-500 text-white rounded font-bold"
                >
                  Confirm Reset
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}