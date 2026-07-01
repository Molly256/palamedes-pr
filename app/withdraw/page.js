'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Withdraw() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [method, setMethod] = useState('')
  const [form, setForm] = useState({ phoneNumber: '', accountName: '', amount: '' })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const localUser = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!localUser.phone) {
      router.push('/login')
      return
    }

    fetch(`/api/admin?action=user&phone=${localUser.phone}`)
     .then(res => res.json())
     .then(data => {
        if (data.success) setUser(data.user)
        else setUser(localUser)
      })
     .catch(() => setUser(localUser))
  }, [router])

  const handleWithdraw = async () => {
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
    if (!amt || amt <= 0) {
      alert('Enter amount')
      return
    }
    if (amt > Number(user.availableBalance || 0)) {
      alert('Insufficient balance')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/transactions', {  // FIXED: added s
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'withdraw',
          phone: user.phone,
          amount: amt,
          method: method === 'MTN'? 'MTN MOBILE MONEY' : 'AIRTEL MOBILE MONEY',
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
      <p className="text-black mb-4">Available Balance: <b>{Number(user.availableBalance || 0).toLocaleString()} shs</b></p>
      <label className="text-black font-bold block mb-2">Select Method</label>

      <div className="flex flex-col gap-3">
        <div>
          <button onClick={() => selectMethod('MTN')} className={`w-full border-2 rounded p-3 text-left font-bold ${method === 'MTN'? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 text-black'}`}>
            MTN MOBILE MONEY
          </button>
          {method === 'MTN' && (
            <div className="flex flex-col gap-3 mt-3">
              <input type="tel" placeholder="Phone number......" value={form.phoneNumber} onChange={(e) => setForm({...form, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })} maxLength={10} className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"/>
              <input type="text" placeholder="Names......." value={form.accountName} onChange={(e) => setForm({...form, accountName: e.target.value })} className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"/>
              <input type="number" placeholder="Input amount......" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value })} className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"/>
            </div>
          )}
        </div>

        <div>
          <button onClick={() => selectMethod('AIRTEL')} className={`w-full border-2 rounded p-3 text-left font-bold ${method === 'AIRTEL'? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 text-black'}`}>
            AIRTEL MOBILE MONEY
          </button>
          {method === 'AIRTEL' && (
            <div className="flex flex-col gap-3 mt-3">
              <input type="tel" placeholder="Phone number....." value={form.phoneNumber} onChange={(e) => setForm({...form, phoneNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })} maxLength={10} className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"/>
              <input type="text" placeholder="Names....." value={form.accountName} onChange={(e) => setForm({...form, accountName: e.target.value })} className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"/>
              <input type="number" placeholder="Input amount........." value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value })} className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"/>
            </div>
          )}
        </div>
      </div>

      {method && (
        <button onClick={handleWithdraw} disabled={loading} className={`w-full py-3 mt-4 rounded font-bold text-lg ${loading? 'bg-gray-400 text-gray-200' : 'bg-red-500 text-white'}`}>
          {loading? 'Processing...' : 'Withdraw'}
        </button>
      )}

      <div className="mt-6 p-3 bg-gray-100 rounded">
        <p className="text-black font-bold mb-1">NOTE:</p>
        <p className="text-black text-sm">money will arrive in your mobile money wallet after admin approval.</p>
      </div>
    </div>
  )
}