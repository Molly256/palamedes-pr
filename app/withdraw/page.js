'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Withdraw() {
  const [user, setUser] = useState(null)
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [amount, setAmount] = useState('')
  const [withdrawNumber, setWithdrawNumber] = useState('')
  const [names, setNames] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const presetAmounts = [10000, 50000, 250000, 500000, 1000000, 2000000, 5000000, 10000000]

  useEffect(() => {
    const userData = localStorage.getItem('palamedes_user')
    if (userData) {
      setUser(JSON.parse(userData))
    } else {
      router.push('/login')
      return
    }

    // Load saved bank info if it exists, but don't block if it's missing
    const bankInfo = JSON.parse(localStorage.getItem('palamedes_bank_info') || 'null')
    if (bankInfo && bankInfo.number && bankInfo.names) {
      setWithdrawNumber(bankInfo.number)
      setNames(bankInfo.names)
    }
  }, [router])

  const methods = [
    { name: 'MTN Mobile money' },
    { name: 'Airtel mobile money' }
  ]

  const handleWithdraw = async () => {
    const withdrawAmount = Number(amount)
    const fee = Math.floor(withdrawAmount * 0.1)
    const netAmount = withdrawAmount - fee

    if (!selectedMethod) {
      alert('Please select withdraw method')
      return
    }

    if (!presetAmounts.includes(withdrawAmount)) {
      alert('enter any amount from above list')
      return
    }

    if (withdrawAmount > user.balance) {
      alert('Insufficient balance')
      return
    }

    // REMOVED bank info check - allow any number/names
    if (!withdrawNumber ||!names) {
      alert('Please enter phone number and names')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'withdraw',
          phone: user.phone,
          value: withdrawAmount,
          method: selectedMethod,
          number: withdrawNumber,
          names: names
        })
      })

      const data = await res.json()
      if (!data.success) {
        alert(data.message || 'Withdraw failed')
        setLoading(false)
        return
      }

      alert(`Withdraw request sent. You receive: ${netAmount.toLocaleString()}shs after 10% fee. Pending approval.`)
      router.push('/transactions')

    } catch (err) {
      console.error(err)
      alert('Something went wrong')
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
          <p style={{ color: '#999', fontSize: '14px', marginBottom: '5px' }}>User account balance</p>
          <h2 style={{ fontSize: '32px', color: '#87CEEB', fontWeight: '900' }}>
            UGX {user.balance.toLocaleString()}
          </h2>
        </div>

        <h1 style={{ fontSize: '26px', color: '#000', marginBottom: '15px', fontWeight: '600' }}>
          Choose withdraw method
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
          {methods.map((method) => (
            <button
              key={method.name}
              onClick={() => setSelectedMethod(method.name)}
              style={{
                width: '100%',
                padding: '18px',
                background: selectedMethod === method.name? '#87CEEB' : '#E0F6FF',
                border: '2px solid #87CEEB',
                borderRadius: '12px',
                fontSize: '17px',
                fontWeight: '500',
                cursor: 'pointer',
                color: '#000',
                transition: 'all 0.2s'
              }}
            >
              {method.name}
            </button>
          ))}
        </div>

        {selectedMethod && (
          <>
            <input
              type="tel"
              placeholder="Number........"
              value={withdrawNumber}
              onChange={(e) => setWithdrawNumber(e.target.value)}
              style={{
                width: '100%',
                padding: '18px',
                border: '2px solid #87CEEB',
                borderRadius: '12px',
                fontSize: '16px',
                outline: 'none',
                marginBottom: '15px',
                background: '#fff'
              }}
            />
            <input
              type="text"
              placeholder="Names........."
              value={names}
              onChange={(e) => setNames(e.target.value)}
              style={{
                width: '100%',
                padding: '18px',
                border: '2px solid #87CEEB',
                borderRadius: '12px',
                fontSize: '16px',
                outline: 'none',
                marginBottom: '15px',
                background: '#fff'
              }}
            />

            <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px', fontWeight: '500' }}>
              Input one of the amount below depending on your account balance.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '15px' }}>
              {presetAmounts.map((amt) => (
                <div
                  key={amt}
                  style={{
                    padding: '14px',
                    background: '#87CEEB',
                    border: '2px solid #87CEEB',
                    borderRadius: '10px',
                    fontSize: '15px',
                    fontWeight: '300',
                    color: '#000',
                    textAlign: 'center',
                    cursor: 'pointer'
                  }}
                  onClick={() => setAmount(String(amt))}
                >
                  {amt.toLocaleString()}shs
                </div>
              ))}
            </div>

            <input
              type="number"
              placeholder="Input amount........"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ width: '100%', padding: '18px', border: '2px solid #87CEEB', borderRadius: '12px', fontSize: '16px', outline: 'none', marginBottom: '20px' }}
            />

            <div style={{ background: '#fff', padding: '15px', borderRadius: '12px', border: '2px solid #87CEEB', marginBottom: '20px', fontSize: '13px', color: '#666', lineHeight: '1.6' }}>
              <p>Note:</p>
              <p>Withdraw fee: 10%</p>
              <p>Withdraws are available 24/7</p>
            </div>

            <button
              onClick={handleWithdraw}
              disabled={loading}
              style={{
                width: '100%',
                padding: '18px',
                background: loading? '#666' : '#87CEEB',
                border: 'none',
                borderRadius: '12px',
                fontSize: '17px',
                fontWeight: '300',
                color: '#000',
                cursor: loading? 'not-allowed' : 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {loading? 'Processing...' : 'Withdraw'}
            </button>
          </>
        )}
      </div>
    </main>
  )
}