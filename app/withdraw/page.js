'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Withdraw() {
  const [user, setUser] = useState(null)
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [amount, setAmount] = useState('')
  const [withdrawNumber, setWithdrawNumber] = useState('')
  const [names, setNames] = useState('')
  const [bankInfoSaved, setBankInfoSaved] = useState(false)
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

    const bankInfo = JSON.parse(localStorage.getItem('palamedes_bank_info') || 'null')
    if (bankInfo && bankInfo.number && bankInfo.names) {
      setWithdrawNumber(bankInfo.number)
      setNames(bankInfo.names)
      setBankInfoSaved(true)
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

    const now = new Date()
    const ugandaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Kampala' }))
    const day = ugandaTime.getDay()
    const hour = ugandaTime.getHours()

    if (day === 0 || day === 6 || hour < 10 || hour >= 17) {
      alert('not time for withdraw')
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

    if (!bankInfoSaved) {
      alert('please first add bank information')
      router.push('/settings')
      return
    }

    try {
      const res = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'withdraw',
          number: withdrawNumber,
          amount: withdrawAmount,
          method: selectedMethod,
          names: names
        })
      })

      const data = await res.json()
      if (!res.ok) {
        alert(data.error)
        return
      }

      // NO instant deduction - admin approves first
      const newTx = {
     ...data.tx,
        method: selectedMethod,
        names: names,
        number: withdrawNumber,
        type: 'withdraw',
        status: 'pending'
      }
      const transactions = JSON.parse(localStorage.getItem('palamedes_transactions') || '[]')
      transactions.unshift(newTx)
      localStorage.setItem('palamedes_transactions', JSON.stringify(transactions))

      alert(`Withdraw request sent. You receive: ${netAmount.toLocaleString()}shs after 10% fee. Money arrives 30mins-24hrs.`)
      router.push('/transactions')

    } catch (err) {
      alert('Something went wrong')
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
              readOnly={bankInfoSaved}
              style={{
                width: '100%',
                padding: '18px',
                border: '2px solid #87CEEB',
                borderRadius: '12px',
                fontSize: '16px',
                outline: 'none',
                marginBottom: '15px',
                background: bankInfoSaved? '#f5f5f5' : '#fff'
              }}
            />
            <input
              type="text"
              placeholder="Names........."
              value={names}
              onChange={(e) => setNames(e.target.value)}
              readOnly={bankInfoSaved}
              style={{
                width: '100%',
                padding: '18px',
                border: '2px solid #87CEEB',
                borderRadius: '12px',
                fontSize: '16px',
                outline: 'none',
                marginBottom: '15px',
                background: bankInfoSaved? '#f5f5f5' : '#fff'
              }}
            />

            <p style={{ fontSize: '14px', color: '#666', marginBottom: '10px', fontWeight: '500' }}>
              Input one of the amount below depending on your account balance.
            </p>

            {/* DISPLAY ONLY AMOUNT BOXES - bold light blue + black lightweight text */}
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
                    textAlign: 'center'
                  }}
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
              <p>Withdraw days: Monday-Friday</p>
              <p>Withdraw time: 10:00am - 5:00pm</p>
            </div>

            <button
              onClick={handleWithdraw}
              style={{
                width: '100%',
                padding: '18px',
                background: '#87CEEB',
                border: 'none',
                borderRadius: '12px',
                fontSize: '17px',
                fontWeight: '300',
                color: '#000',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#7bb8d4'}
              onMouseOut={(e) => e.currentTarget.style.background = '#87CEEB'}
            >
              Withdraw
            </button>
          </>
        )}
      </div>
    </main>
  )
}