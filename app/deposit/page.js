'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Deposit() {
  const [user, setUser] = useState(null)
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem('palamedes_user')
    if (userData) {
      setUser(JSON.parse(userData))
    } else {
      router.push('/login')
    }
  }, [router])

  const methods = [
    { name: 'MTN Mobile money', number: '0769306151', account: 'BETTY ANYAITI' },
    { name: 'Airtel mobile money', number: '0748575505', account: 'ANTHONY OTIBOK' }
  ]

  const handlePaid = async () => {
    const depositAmount = Number(amount)

    if (!selectedMethod) {
      alert('Please select a deposit method first')
      return
    }
    if (!amount || depositAmount < 10000) {
      alert('Minimum deposit is 10,000shs')
      return
    }
    if (!user?.phone) {
      alert('User phone missing. Please login again')
      router.push('/login')
      return
    }

    setLoading(true)

    try {
      // Clean phone to digits only before sending
      const cleanPhone = user.phone.replace(/\D/g, '')

      const res = await fetch('/api/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: cleanPhone,
          amount: depositAmount,
          method: selectedMethod
        })
      })

      const data = await res.json()
      if (!data.success) {
        alert(data.message || 'Deposit failed')
        setLoading(false)
        return
      }

      alert(`Deposit request submitted! ${depositAmount.toLocaleString()}shs pending approval.`)
      router.push('/transactions')

    } catch (err) {
      console.error(err)
      alert('Something went wrong. Try again')
    } finally {
      setLoading(false)
    }
  }

  if (!user) return <div style={{ textAlign: 'center', padding: '100px' }}>Loading...</div>

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f5', padding: '40px 20px' }}>
      <div style={{ maxWidth: '650px', margin: '0 auto' }}>

        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: '16px', color: '#87CEEB', cursor: 'pointer', marginBottom: '20px', fontWeight: '500' }}>
          ← Back
        </button>

        <div style={{ background: '#fff', padding: '20px', borderRadius: '12px', border: '2px solid #87CEEB', marginBottom: '25px', textAlign: 'center' }}>
          <p style={{ color: '#999', fontSize: '14px', marginBottom: '5px' }}>Available Balance</p>
          <h2 style={{ fontSize: '32px', color: '#87CEEB', fontWeight: '900' }}>
            shs {user.balance.toLocaleString()}
          </h2>
        </div>

        <h1 style={{ fontSize: '26px', color: '#000', marginBottom: '25px', fontWeight: '600' }}>
          Choose deposit method
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
          {methods.map((method) => (
            <div key={method.name}>
              <button onClick={() => setSelectedMethod(method.name)} style={{
                width: '100%', padding: '18px', background: selectedMethod === method.name? '#87CEEB' : '#E0F6FF',
                border: '2px solid #87CEEB', borderRadius: '12px', fontSize: '17px', fontWeight: '500',
                cursor: 'pointer', color: '#000', transition: 'all 0.2s'
              }}>
                {method.name}
              </button>

              {selectedMethod === method.name && (
                <div style={{ background: '#fff', border: '2px solid #87CEEB', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '20px', textAlign: 'center' }}>
                  <p style={{ fontSize: '32px', fontWeight: '900', color: '#000', marginBottom: '5px' }}>{method.number}</p>
                  <p style={{ fontSize: '16px', color: '#666', marginBottom: '15px' }}>{method.account}</p>
                  <p style={{ fontSize: '14px', color: '#999', fontStyle: 'italic' }}>NOTE: Go pay come back tap button below</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {selectedMethod && (
          <>
            <div style={{ marginBottom: '20px' }}>
              <input type="number" placeholder="Input amount............." value={amount} onChange={(e) => setAmount(e.target.value)} style={{
                width: '100%', padding: '18px', border: '2px solid #87CEEB', borderRadius: '12px', fontSize: '16px', outline: 'none'
              }} />
              <p style={{ color: '#666', fontSize: '13px', marginTop: '8px', marginLeft: '5px' }}>
                Minimum deposit is 10,000shs
              </p>
            </div>

            <button onClick={handlePaid} disabled={loading} style={{
              width: '100%', padding: '18px', background: loading? '#666' : '#000', border: 'none', borderRadius: '12px',
              fontSize: '17px', fontWeight: '700', color: '#87CEEB', cursor: loading? 'not-allowed' : 'pointer', transition: 'all 0.2s'
            }}>
              {loading? 'Processing...' : 'I HAVE PAID MONEY'}
            </button>
          </>
        )}
      </div>
    </main>
  )
}