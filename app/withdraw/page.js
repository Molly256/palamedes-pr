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
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false)
  const [timeMessage, setTimeMessage] = useState('')
  const router = useRouter()

  const presetAmounts = [10000, 50000, 250000, 500000, 1000000, 2000000, 5000000, 10000000]

  useEffect(() => {
    const userData = localStorage.getItem('palamedes_user')
    if (!userData) {
      router.push('/login')
      return
    }

    const localUser = JSON.parse(userData)
    loadUser(localUser.phone)

    const bankInfo = JSON.parse(localStorage.getItem('palamedes_bank_info') || 'null')
    if (bankInfo && bankInfo.number && bankInfo.names) {
      setWithdrawNumber(bankInfo.number)
      setNames(bankInfo.names)
    }

    checkWithdrawWindow()
  }, [router])

  const loadUser = async (phone) => {
    try {
      const res = await fetch(`/api/user?action=getDashboard&phone=${phone}&t=${Date.now()}`)
      const data = await res.json()
      if (data.success && data.user) {
        setUser(data.user)
        localStorage.setItem('palamedes_user', JSON.stringify(data.user))
      }
    } catch (e) {
      console.log('Failed to fetch user:', e)
    }
  }

  const checkWithdrawWindow = () => {
    const now = new Date()
    const ugandaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Kampala' }))

    const day = ugandaTime.getDay()
    const hour = ugandaTime.getHours()
    const minute = ugandaTime.getMinutes()

    const isWeekday = day >= 1 && day <= 5
    const isOpenTime = (hour > 10 || (hour === 10 && minute >= 0)) && (hour < 17 || (hour === 17 && minute === 0))

    setIsWithdrawOpen(isWeekday && isOpenTime)

    if (!isWeekday) {
      setTimeMessage('Withdrawals are only available Monday to Friday')
    } else if (!isOpenTime) {
      setTimeMessage('Withdrawals are available 10:00 AM - 5:00 PM EAT only')
    }
  }

  const methods = [
    { name: 'MTN Mobile money' },
    { name: 'Airtel mobile money' }
  ]

  const handleWithdraw = async () => {
    if (!isWithdrawOpen) {
      alert(timeMessage)
      return
    }

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

    if (withdrawAmount > user.available_balance) {
      alert('Insufficient balance')
      return
    }

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
          <p style={{ color: '#999', fontSize: '14px', marginBottom: '5px' }}>Available Balance</p>
          <h2 style={{ fontSize: '32px', color: '#87CEEB', fontWeight: '900' }}>
            UGX {user.available_balance.toLocaleString()}
          </h2>
        </div>

        {!isWithdrawOpen && (
          <div style={{
            background: '#fef3c7',
            padding: '15px',
            borderRadius: '12px',
            border: '2px solid #f59e0b',
            marginBottom: '20px',
            textAlign: 'center',
            color: '#92400e',
            fontWeight: '600'
          }}>
            {timeMessage}
          </div>
        )}

        <h1 style={{ fontSize: '26px', color: '#000', marginBottom: '15px', fontWeight: '600' }}>
          Choose withdraw method
        </h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }}>
          {methods.map((method) => (
            <button
              key={method.name}
              onClick={() => setSelectedMethod(method.name)}
              disabled={!isWithdrawOpen}
              style={{
                width: '100%',
                padding: '18px',
                background:!isWithdrawOpen? '#e5e7eb' : selectedMethod === method.name? '#87CEEB' : '#E0F6FF',
                border: '2px solid #87CEEB',
                borderRadius: '12px',
                fontSize: '17px',
                fontWeight: '500',
                cursor:!isWithdrawOpen? 'not-allowed' : 'pointer',
                color: '#000',
                opacity:!isWithdrawOpen? 0.6 : 1,
                transition: 'all 0.2s'
              }}
            >
              {method.name}
            </button>
          ))}
        </div>

        {selectedMethod && isWithdrawOpen && (
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
              <p>Withdraws available: Mon-Fri 10:00 AM - 5:00 PM EAT</p>
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