'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Deposit() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const normalizePhone = (phone) => {
    if (!phone) return ''
    phone = String(phone).replace(/\D/g, '')
    if (!/^07\d{8}$/.test(phone)) {
      return ''
    }
    return phone
  }

  useEffect(() => {
    const userData = localStorage.getItem('palamedes_user')
    const userToken = localStorage.getItem('token')
    
    if (!userData || !userToken) {
      router.push('/login')
      return
    }
    
    setUser(JSON.parse(userData))
    setToken(userToken)
  }, [router])

  const methods = [
    { name: 'MTN Mobile money', number: '0743946046', account: 'ALLEN NAWANGI' },
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
    if (!token) {
      alert('Session expired. Please login again')
      router.push('/login')
      return
    }

    setLoading(true)

    try {
      const cleanPhone = normalizePhone(user.phone)
      if (!cleanPhone) {
        alert('Invalid phone number. Please login again')
        router.push('/login')
        setLoading(false)
        return
      }

      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-session-token': token
        },
        body: JSON.stringify({
          action: 'deposit',
          phone: cleanPhone,
          value: depositAmount,
          method: selectedMethod
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        alert(data.message || 'Deposit failed')
        setLoading(false)
        
        if (res.status === 401) {
          localStorage.removeItem('token')
          localStorage.removeItem('palamedes_user')
          router.push('/login')
        }
        return
      }

      alert(`Deposit request submitted! ${depositAmount.toLocaleString()}shs pending approval.`)
      window.dispatchEvent(new Event('refreshTransactions'))
      router.push('/transactions')

    } catch (err) {
      console.error('Deposit error:', err)
      alert('Something went wrong. Try again')
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return React.createElement('div', { 
      style: { textAlign: 'center', padding: '100px' } 
    }, 'Loading...')
  }

  const displayBalance = Number(user?.available_balance ?? user?.balance ?? 0)

  return React.createElement('main', {
    style: { minHeight: '100vh', background: '#f5f5f5', padding: '40px 20px' }
  }, React.createElement('div', {
    style: { maxWidth: '650px', margin: '0 auto' }
  }, [
    React.createElement('button', {
      key: 'back',
      onClick: () => router.back(),
      style: { 
        background: 'none', 
        border: 'none', 
        fontSize: '16px', 
        color: '#87CEEB', 
        cursor: 'pointer', 
        marginBottom: '20px', 
        fontWeight: '500' 
      }
    }, '← Back'),

    React.createElement('div', {
      key: 'balance',
      style: { 
        background: '#fff', 
        padding: '20px', 
        borderRadius: '12px', 
        border: '2px solid #87CEEB', 
        marginBottom: '25px', 
        textAlign: 'center' 
      }
    }, [
      React.createElement('p', {
        key: 'label',
        style: { color: '#999', fontSize: '14px', marginBottom: '5px' }
      }, 'Available Balance'),
      React.createElement('h2', {
        key: 'amount',
        style: { fontSize: '32px', color: '#87CEEB', fontWeight: '900' }
      }, `shs ${displayBalance.toLocaleString()}`)
    ]),

    React.createElement('h1', {
      key: 'title',
      style: { fontSize: '26px', color: '#000', marginBottom: '25px', fontWeight: '600' }
    }, 'Choose deposit method'),

    React.createElement('div', {
      key: 'methods',
      style: { display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '20px' }
    }, methods.map((method) => 
      React.createElement('div', { key: method.name }, [
        React.createElement('button', {
          key: 'btn',
          onClick: () => setSelectedMethod(method.name),
          style: {
            width: '100%', 
            padding: '18px', 
            background: selectedMethod === method.name ? '#87CEEB' : '#E0F6FF',
            border: '2px solid #87CEEB', 
            borderRadius: '12px', 
            fontSize: '17px', 
            fontWeight: '500',
            cursor: 'pointer', 
            color: '#000', 
            transition: 'all 0.2s'
          }
        }, method.name),

        selectedMethod === method.name && React.createElement('div', {
          key: 'details',
          style: { 
            background: '#fff', 
            border: '2px solid #87CEEB', 
            borderTop: 'none', 
            borderRadius: '0 0 12px 12px', 
            padding: '20px', 
            textAlign: 'center' 
          }
        }, [
          React.createElement('p', {
            key: 'number',
            style: { fontSize: '32px', fontWeight: '900', color: '#000', marginBottom: '5px' }
          }, method.number),
          React.createElement('p', {
            key: 'account',
            style: { fontSize: '16px', color: '#666', marginBottom: '15px' }
          }, method.account),
          React.createElement('p', {
            key: 'note',
            style: { fontSize: '14px', color: '#999', fontStyle: 'italic' }
          }, 'NOTE: Go pay come back tap button below')
        ])
      ])
    )),

    selectedMethod && React.createElement('div', { key: 'deposit-form' }, [
      React.createElement('div', {
        key: 'input-wrap',
        style: { marginBottom: '20px' }
      }, [
        React.createElement('input', {
          key: 'input',
          type: 'number',
          placeholder: 'Input amount.............',
          value: amount,
          onChange: (e) => setAmount(e.target.value),
          style: {
            width: '100%',
            padding: '18px',
            border: '2px solid #87CEEB',
            borderRadius: '12px',
            fontSize: '16px',
            outline: 'none'
          }
        }),
        React.createElement('p', {
          key: 'hint',
          style: { color: '#666', fontSize: '13px', marginTop: '8px', marginLeft: '5px' }
        }, 'Minimum deposit is 10,000shs')
      ]),

      React.createElement('button', {
        key: 'submit',
        onClick: handlePaid,
        disabled: loading,
        style: {
          width: '100%',
          padding: '18px',
          background: loading ? '#666' : '#000',
          border: 'none',
          borderRadius: '12px',
          fontSize: '17px',
          fontWeight: '700',
          color: '#87CEEB',
          cursor: loading ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s'
        }
      }, loading ? 'Processing...' : 'I HAVE PAID MONEY')
    ])
  ]))
}