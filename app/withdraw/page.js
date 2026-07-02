'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Withdraw() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [method, setMethod] = useState('')
  const [form, setForm] = useState({ phoneNumber: '', accountName: '', amount: '' })
  const [loading, setLoading] = useState(false)

  const VALID_AMOUNTS = [10000, 50000, 250000, 350000, 500000, 750000, 1000000, 2000000]

  useEffect(() => {
    const localUser = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!localUser.phone) return router.push('/login')

    fetch(`/api/admin?action=user&phone=${localUser.phone}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setUser(data.user)
          localStorage.setItem('palamedes_user', JSON.stringify(data.user))
        } else { setUser(localUser) }
      }).catch(() => setUser(localUser))
  }, [router])

  const verifyUgandanTime = () => {
    // Converts current time accurately into Uganda's numeric hours and days
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Kampala',
      hour: 'numeric',
      hour12: false,
      weekday: 'numeric'
    })
    
    const parts = formatter.formatToParts(new Date())
    const hour = Number(parts.find(p => p.type === 'hour').value)
    // Intl weekday maps 1 = Monday, ..., 5 = Friday, 6 = Saturday, 7 = Sunday
    const dayStr = parts.find(p => p.type === 'weekday').value 

    // Block weekends or times outside 10:00 AM - 5:00 PM (10 to 17)
    if (dayStr === 'Saturday' || dayStr === 'Sunday' || hour < 10 || hour >= 17) {
      alert('Not time fr withdraw') // <- CHANGED: Exact requested error text
      return false
    }
    return true
  }

  const handleWithdraw = async () => {
    if (!verifyUgandanTime()) return
    const amt = Number(form.amount.replace(/,/g, ''))

    if (!method) return alert('Select a method first')
    if (!/^07\d{8}$/.test(form.phoneNumber)) return alert('Enter valid phone number')
    if (!form.accountName.trim()) return alert('Enter names')
    if (!amt || amt <= 0) return alert('Enter amount')
    if (!VALID_AMOUNTS.includes(amt)) return alert('invalid amount')
    if (amt > Number(user.availableBalance || 0)) return alert('Insufficient balance')

    setLoading(true)
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'withdraw', phone: user.phone, amount: amt,
          method: method === 'MTN' ? 'MTN MOBILE MONEY' : 'AIRTEL MOBILE MONEY',
          withdrawPhone: form.phoneNumber, withdrawName: form.accountName
        })
      })

      const data = await res.json()
      if (!res.ok) return alert(data.error || 'Withdrawal failed')

      const updatedUser = { ...user, availableBalance: Number(user.availableBalance || 0) - amt }
      setUser(updatedUser)
      localStorage.setItem('palamedes_user', JSON.stringify(updatedUser))

      alert('Withdraw success') // <- CHANGED: Exact requested success text
      router.push('/transactions')
    } catch { alert('Something went wrong') } finally { setLoading(false) }
  }

  if (!user) return <div className="p-4 text-black font-bold">Loading...</div>

  return (
    <div className="min-h-screen bg-white p-4 max-w-[480px] mx-auto">
      <div className="bg-[#00BFFF] rounded-xl p-4 text-black mb-4 shadow-sm">
        <span className="text-xs font-bold uppercase tracking-wider block opacity-80">Available Balance</span>
        <h2 className="text-2xl font-black mt-1">{Number(user.availableBalance || 0).toLocaleString()} shs</h2>
      </div>

      <label className="text-black font-bold block mb-2 text-sm">Select withdraw method</label>
      <div className="flex flex-col gap-3 mb-4">
        {['MTN', 'AIRTEL'].map(m => (
          <div key={m}>
            <button onClick={() => { setMethod(m); setForm({ phoneNumber: '', accountName: '', amount: '' }) }} className={`w-full border rounded-lg p-3 text-left font-bold text-sm ${method === m ? 'border-black bg-[#87CEEB]' : 'border-gray-300'} text-black`}>
              * {m} Mobile money
            </button>
            {method === m && (
              <div className="flex flex-col gap-2 mt-2">
                <label className="text-xs font-bold text-black">Input mobile money number</label>
                <input type="tel" placeholder="e.g. 07XXXXXXXX" value={form.phoneNumber} onChange={e => setForm({...form, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10)})} maxLength={10} className="w-full border border-gray-300 rounded-lg px-3 h-10 text-black bg-[#FAFAFA] text-sm outline-none"/>
                <label className="text-xs font-bold text-black">Input mobile money holder's names</label>
                <input type="text" placeholder="Account registered name" value={form.accountName} onChange={e => setForm({...form, accountName: e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 h-10 text-black bg-[#FAFAFA] text-sm outline-none"/>
              </div>
            )}
          </div>
        ))}
      </div>

      {method && (
        <>
          <label className="text-black font-bold block mb-2 text-sm">Valid Company's withdraw amounts</label>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {VALID_AMOUNTS.map(amt => (
              <div key={amt} onClick={() => setForm({ ...form, amount: amt.toString() })} className="bg-[#00BFFF] rounded-lg py-2 text-center cursor-pointer active:scale-95 transition-transform" style={{ border: form.amount === amt.toString() ? '2px solid #000' : 'none' }}>
                <span className="text-[10px] font-normal text-black">{amt.toLocaleString()}shs</span>
              </div>
            ))}
          </div>

          <label className="text-black font-bold block mb-1 text-sm">Input amount according to the displayed format</label>
          <input type="text" placeholder="e.g. 10000" value={form.amount} onChange={e => setForm({...form, amount: e.target.value.replace(/\D/g, '')})} className="w-full border border-gray-300 rounded-lg px-3 h-10 text-black bg-[#FAFAFA] font-bold text-sm outline-none mb-4"/>

          <button onClick={handleWithdraw} disabled={loading} className={`w-full h-12 rounded-lg font-normal text-base ${loading ? 'bg-gray-300 text-gray-500' : 'bg-[#00BFFF] text-black'}`}>
            {loading ? 'Processing...' : 'Withdraw'}
          </button>
        </>
      )}

      <div className="mt-6 p-4 bg-gray-100 rounded-xl border border-gray-200">
        <p className="text-black font-black mb-2 text-sm">Note:</p>
        <div className="flex flex-col gap-1.5 text-xs text-gray-800 font-bold">
          <p>Minimum withdraw amount: <span className="text-black font-extrabold">10,000shs</span></p>
          <p>Withdraw days: <span className="text-black font-extrabold">Monday to Friday</span></p>
          <p>Withdraw time: <span className="text-black font-extrabold">10:00am -5:00pm</span></p>
          <p>Money will arrive in your mobile money wallet within <span className="text-green-600 font-extrabold">30mins -24hours max.</span></p>
        </div>
      </div>
    </div>
  )
}