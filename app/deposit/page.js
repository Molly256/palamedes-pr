'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Deposit() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [method, setMethod] = useState('MTN')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)

  const paymentDetails = {
    MTN: { number: '0743946046', name: 'ALLEN NAWAGI' },
    AIRTEL: { number: '0748575505', name: 'ANTHONY OTIBOK' }
  }

  useEffect(() => {
    const localUser = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!localUser.phone) {
      router.push('/login')
      return
    }
    setUser(localUser)
  }, [])

  const handleDeposit = async () => {
    const amt = Number(amount)
    
    if (!amt || amt < 10000) {
      alert('Minimum deposit is 10,000 shs')
      return
    }

    setLoading(true)
    
    try {
      const res = await fetch('/api/transaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'deposit',
          phone: user.phone,
          amount: amt,
          method: method
        })
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error)
        setLoading(false)
        return
      }

      alert('Deposit request submitted. Wait for admin approval.')
      router.push('/transactions')
      
    } catch (err) {
      alert('Something went wrong')
      setLoading(false)
    }
  }

  if (!user) return <div className="p-4 text-black">Loading...</div>

  return (
    <div className="min-h-screen bg-white p-4">
      <h1 className="text-2xl font-bold text-black mb-6">Deposit</h1>

      {/* Payment Method Select */}
      <div className="mb-6">
        <label className="text-black font-bold block mb-2">Select Payment Method:</label>
        
        <div className="flex flex-col gap-3">
          
          {/* MTN */}
          <div 
            onClick={() => setMethod('MTN')}
            className={`border-2 rounded p-3 cursor-pointer ${method === 'MTN' ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}
          >
            <p className="text-black font-bold">MTN MOBILE MONEY</p>
            <p className="text-black">{paymentDetails.MTN.number} {paymentDetails.MTN.name}</p>
          </div>

          {/* AIRTEL */}
          <div 
            onClick={() => setMethod('AIRTEL')}
            className={`border-2 rounded p-3 cursor-pointer ${method === 'AIRTEL' ? 'border-red-500 bg-red-50' : 'border-gray-300'}`}
          >
            <p className="text-black font-bold">AIRTEL MOBILE MONEY</p>
            <p className="text-black">{paymentDetails.AIRTEL.number} {paymentDetails.AIRTEL.name}</p>
          </div>
        </div>
      </div>

      {/* Minimum Deposit */}
      <p className="text-black font-bold mb-3">Minimum deposit 10,000shs</p>

      {/* Amount Input */}
      <div className="mb-4">
        <label className="text-black font-bold block mb-2">Amount:</label>
        <input
          type="number"
          placeholder="Input amount......."
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border-gray-300 rounded px-3 py-2 text-black bg-white"
        />
      </div>

      {/* Submit Button */}
      <button
        onClick={handleDeposit}
        disabled={loading}
        className="w-full py-3 bg-green-500 text-white rounded font-bold text-lg"
      >
        {loading ? 'Processing...' : 'I HAVE PAID THE MONEY'}
      </button>

      <p className="text-gray-600 text-sm mt-3 text-center">
        After paying, tap the button. Admin will approve and balance will update.
      </p>
    </div>
  )
}