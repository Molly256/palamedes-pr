'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Withdraw() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [method, setMethod] = useState('') 
  const [form, setForm] = useState({ phoneNumber: '', accountName: '', amount: '' })
  const [loading, setLoading] = useState(false)
  const [canWithdraw, setCanWithdraw] = useState(false)
  const [timeMsg, setTimeMsg] = useState('')

  useEffect(() => {
    const localUser = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!localUser.phone) {
      router.push('/login')
      return
    }
    setUser(localUser)

    // Check Uganda time every minute
    const checkTime = () => {
      const now = new Date()
      
      // Get Uganda time
      const ugTime = new Intl.DateTimeFormat('en-UG', {
        timeZone: 'Africa/Kampala',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'short',
        hour12: false
      }).formatToParts(now)

      const parts = {}
      ugTime.forEach(p => parts[p.type] = p.value)
      
      const day = parts.weekday // Mon, Tue, Wed, Thu, Fri, Sat, Sun
      const hour = parseInt(parts.hour)
      const minute = parseInt(parts.minute)

      const isWeekend = day === 'Sat' || day === 'Sun'
      const isWithinHours = hour >= 10 && (hour < 17 || (hour === 17 && minute === 0))

      if (isWeekend) {
        setCanWithdraw(false)
        setTimeMsg('Withdrawals only available Monday - Friday')
      } else if (!isWithinHours) {
        setCanWithdraw(false)
        if (hour < 10) {
          setTimeMsg('Withdrawals open at 10:00am Uganda time')
        } else {
          setTimeMsg('Withdrawals closed. Reopens Monday-Friday at 10:00am')
        }
      } else {
        setCanWithdraw(true)
        setTimeMsg('Withdrawals open: Mon-Fri 10:00am - 5:00pm Uganda time')
      }
    }

    checkTime()
    const interval = setInterval(checkTime, 60000) // check every minute
    
    return () => clearInterval(interval)
  }, [])

  const handleWithdraw = async () => {
    if (!canWithdraw) {
      alert(timeMsg)
      return
    }
    // ... rest of your existing handleWithdraw code
    const amt = Number(form.amount)
    
    if (!method) {
      alert('Select a method first')
      return
    }
    if (!/^07\d{8}$/.test(form.phoneNumber)) {
      alert('Enter valid phone number')
      return
    }
    if (!form.accountName.trim()) {
      alert('Enter names')
      return
    }
    if (!amt || amt < 10000) {
      alert('Minimum withdraw is 10,000 shs')
      return
    }
    if (amt > Number(user.balance || 0)) {
      alert('Insufficient balance')
      return
    }

    setLoading(true)
    
    try {
      const res = await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'withdraw',
          phone: user.phone,
          amount: amt,
          method: method === 'MTN' ? 'MTN MOBILE MONEY' : 'AIRTEL MOBILE MONEY',
          withdrawPhone: form.phoneNumber,
          withdrawName: form.accountName
        })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error)
        setLoading(false)
        return
      }

      alert('Withdraw request submitted. Wait for admin approval.')
      router.push('/transactions')
      
    } catch (err) {
      alert('Something went wrong')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  const selectMethod = (m) => {
    setMethod(m)
    setForm({ phoneNumber: '', accountName: '', amount: '' })
  }

  if (!user) return <div className="p-4 text-black">Loading...</div>

  return (
    <div className="min-h-screen bg-white p-4">
      <h1 className="text-2xl font-bold text-black mb-4">Withdraw</h1>

      <p className="text-black mb-2">Available Balance: <b>{Number(user.balance || 0).toLocaleString()} shs</b></p>
      
      {/* Time status */}
      <p className={`text-sm mb-4 ${canWithdraw ? 'text-green-600' : 'text-red-600'}`}>
        {timeMsg}
      </p>

      <label className="text-black font-bold block mb-2">Select Method</label>
      
      <div className="flex flex-col gap-3">
        
        {/* MTN MOBILE MONEY */}
        <div>
          <button
            onClick={() => selectMethod('MTN')}
            disabled={!canWithdraw}
            className={`w-full border-2 rounded p-3 text-left font-bold ${method === 'MTN' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-black'} ${!canWithdraw ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            MTN MOBILE MONEY
          </button>

          {method === 'MTN' && canWithdraw && (
            <div className="flex flex-col gap-3 mt-3">
              <input
                type="tel"
                placeholder="Phone number......"
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                maxLength={10}
                className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"
              />
              <input
                type="text"
                placeholder="Names......."
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"
              />
              <input
                type="number"
                placeholder="Input amount......"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"
              />
            </div>
          )}
        </div>

        {/* AIRTEL MOBILE MONEY */}
        <div>
          <button
            onClick={() => selectMethod('AIRTEL')}
            disabled={!canWithdraw}
            className={`w-full border-2 rounded p-3 text-left font-bold ${method === 'AIRTEL' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 text-black'} ${!canWithdraw ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            AIRTEL MOBILE MONEY
          </button>

          {method === 'AIRTEL' && canWithdraw && (
            <div className="flex flex-col gap-3 mt-3">
              <input
                type="tel"
                placeholder="Phone number....."
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                maxLength={10}
                className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"
              />
              <input
                type="text"
                placeholder="Names ....."
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"
              />
              <input
                type="number"
                placeholder="Input amount ........."
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Withdraw Button */}
      {method && (
        <button
          onClick={handleWithdraw}
          disabled={loading || !canWithdraw}
          className={`w-full py-3 mt-4 rounded font-bold text-lg ${
            canWithdraw && !loading 
              ? 'bg-red-500 text-white' 
              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
          }`}
        >
          {loading ? 'Processing...' : 'Withdraw'}
        </button>
      )}

      {/* Note */}
      <div className="mt-6 p-3 bg-gray-100 rounded">
        <p className="text-black font-bold mb-1">NOTE:</p>
        <p className="text-black text-sm">minimum withdraw: 10,000shs</p>
        <p className="text-black text-sm">withdraw days: Monday - Friday</p>
        <p className="text-black text-sm">withdraw time: 10:00am - 5:00pm</p>
        <p className="text-black text-sm">money will arrive in your mobile money wallet within 30 minutes to 24hrs max.</p>
      </div>
    </div>
  )
}