'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Admin() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [pending, setPending] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')

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

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2000)
  }

  const handleAction = async (id, action) => {
    setPending(prev => prev.filter(tx => tx.id !== id))

    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateStatus', id, status: action })
    })
    const data = await res.json()
    if (data.success) {
      showToast(`Transaction ${action}`)
    } else {
      showToast(data.error)
      loadPending()
    }
  }

  const searchUser = async () => {
    if (!/^07\d{8}$/.test(searchPhone)) {
      showToast('Enter valid phone')
      return
    }
    const res = await fetch(`/api/admin?action=user&phone=${searchPhone}`)
    const data = await res.json()
    if (data.success) {
      setFoundUser(data.user)
    } else {
      showToast('User not found')
      setFoundUser(null)
    }
  }

  const resetPassword = async () => {
    if (!/^[a-zA-Z0-9]{6}$/.test(tempPassword)) {
      showToast('Password must be 6 letters/numbers')
      return
    }
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resetPassword', phone: searchPhone, password: tempPassword })
    })
    const data = await res.json()
    if (data.success) {
      showToast('Password reset. Tell user: ' + tempPassword)
      setShowResetBox(false)
      setTempPassword('')
    } else {
      showToast(data.error)
    }
  }

  if (!user) return <div className="p-4 text-black font-bold">Loading...</div>

  return (
    <div className="min-h-screen bg-white p-4 pb-24">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[99999] bg-black text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.push('/dashboard')} className="text-2xl text-black">←</button>
        <h1 className="text-2xl font-bold text-black">Admin Panel</h1>
      </div>

      {/* Section 1: Pending Transactions */}
      <div className="mb-8">
        <h2 className="text-xl font-bold text-black mb-3">Pending Transactions</h2>
        {loading ? (
          <p className="text-black">Loading...</p>
        ) : pending.length === 0 ? (
          <p className="text-gray-600">No pending transactions</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pending.map(tx => {
              const isWithdraw = String(tx.type || '').toLowerCase().trim() === 'withdraw'
              return (
                <div key={tx.id} className="border border-gray-300 rounded-lg p-4 bg-gray-50 shadow-sm">
                  <p className="text-black font-black text-base border-b border-gray-200 pb-1 mb-2">
                    {tx.type.toUpperCase()} - {Number(tx.amount).toLocaleString()} shs
                  </p>
                  
                  {/* Detailed layout metadata block for checking withdrawal logs context fields */}
                  <div className="flex flex-col gap-1 text-sm text-gray-800 font-bold mb-2">
                    <p>Requested User Account: <span className="text-black font-black">{tx.phone}</span></p>
                    {isWithdraw && (
                      <>
                        <p>Target Mobile Money No: <span className="text-blue-600 font-black">{tx.withdrawPhone || tx.phoneNumber}</span></p>
                        <p>Receiver Holder Name: <span className="text-black font-black">{tx.withdrawName || tx.accountName}</span></p>
                      </>
                    )}
                    <p>Payment Network Method: <span className="text-black font-black">{tx.method || 'MOBILE MONEY'}</span></p>
                    <p className="text-gray-500 text-xs font-normal mt-1">Submitted At: {tx.createdAt}</p>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleAction(tx.id, 'success')}
                      className="px-5 py-2 bg-green-500 text-white rounded-lg font-bold text-sm shadow-sm"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleAction(tx.id, 'failed')}
                      className="px-5 py-2 bg-red-500 text-white rounded-lg font-bold text-sm shadow-sm"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
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
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-black bg-white outline-none"
          />
          <button
            onClick={searchUser}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-bold shadow-sm"
          >
            🔍
          </button>
        </div>

        {foundUser && (
          <div className="border border-gray-300 rounded-lg p-4 bg-gray-50 shadow-sm">
            <p className="text-black mb-1"><b>Username:</b> {foundUser.username}</p>
            <p className="text-black mb-1"><b>Phone:</b> {foundUser.phone}</p>
            <p className="text-black mb-2"><b>Password:</b> {foundUser.password}</p>
            <button
              onClick={() => setShowResetBox(true)}
              className="mt-1 px-4 py-2 bg-yellow-500 text-black rounded-lg font-bold text-sm shadow-sm"
            >
              Reset Password
            </button>

            {showResetBox && (
              <div className="mt-3 p-3 bg-white border border-gray-300 rounded-lg shadow-inner">
                <input
                  type="text"
                  placeholder="New temp password 6 chars"
                  value={tempPassword}
                  onChange={(e) => setTempPassword(e.target.value)}
                  maxLength={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-black mb-3 bg-white outline-none"
                />
                <button
                  onClick={resetPassword}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg font-bold text-sm shadow-sm"
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