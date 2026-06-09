'use client'
import { useState, useEffect } from 'react'

const cardStyle = {
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '12px',
  marginBottom: '12px',
  display: 'flex',
  gap: '12px'
}
const imgStyle = {
  width: '80px',
  height: '80px',
  borderRadius: '6px',
  objectFit: 'cover',
  flexShrink: 0
}
const btnStyle = {
  backgroundColor: '#00BFFF',
  color: 'black',
  fontWeight: '300',
  padding: '6px 12px',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '13px',
  marginTop: '6px'
}
const labelStyle = { fontSize: '13px', fontWeight: '300', color: 'black', marginBottom: '2px' }

export default function HotPage() {
  const [invested, setInvested] = useState({})
  const [phone, setPhone] = useState('')

  const dividends = [
    {
      id: 'pride',
      name: 'PRIDE AND PREJUDICE',
      cycle: '30days',
      profit: '1%',
      min: '50,000shs',
      img: '/images/pride.jpg'
    },
    {
      id: 'hegel',
      name: 'Hegel lectures',
      cycle: '120days',
      profit: '3%',
      min: '50,000shs',
      img: '/images/hegel.jpg'
    },
    {
      id: 'whale',
      name: 'The whale',
      cycle: '180days',
      profit: '5%',
      min: '50,000shs',
      img: '/images/whale.jpg'
    }
  ]

  // Load user phone + check owned shares on mount
  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('user') || '{}')
    setPhone(userData.phone || '')
    loadShares(userData.phone)
  }, [])

  const loadShares = async (userPhone) => {
    if (!userPhone) return
    try {
      const res = await fetch(`/api/user?action=getShares&phone=${userPhone}`)
      const data = await res.json()
      if (data.success && data.shares) {
        const owned = {}
        Object.keys(data.shares).forEach(id => owned[id] = true)
        setInvested(owned)
      }
    } catch (err) {
      console.error('Load shares error:', err)
    }
  }

  const handleInvest = async (item) => {
    if (!phone) {
      alert('Please login first')
      return
    }

    const btn = document.getElementById(`btn-${item.id}`)
    if (btn) btn.disabled = true

    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'buyShare',
          phone: phone,
          shareId: item.id,
          shareName: item.name
        })
      })
      const data = await res.json()

      if (data.success) {
        setInvested({...invested, [item.id]: true})
        alert(`Success! ${item.name} purchased. New balance: ${data.balance}shs`)
        
        // Update dashboard balance if you have it in localStorage
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        user.balance = data.balance
        localStorage.setItem('user', JSON.stringify(user))
      } else {
        alert(data.message)
      }
    } catch (err) {
      alert('Network error. Try again')
      console.error(err)
    } finally {
      if (btn) btn.disabled = false
    }
  }

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#f9fafb', paddingBottom: '96px'}}>
      <h1 style={{fontSize: '20px', fontWeight: 'bold', textAlign: 'center', padding: '16px', backgroundColor: 'white', color: 'black', borderBottom: '1px solid #e5e7eb'}}>
        PALAMEDES PR COMPANY
      </h1>

      <div style={{padding: '16px'}}>
        <p style={{fontSize: '14px', fontWeight: '300', color: 'black', textAlign: 'center', marginBottom: '16px'}}>
          Welcome to PALAMEDES PR COMPANY board management<br/>
          Buy dividends and increase on your monthly income<br/>
          When you buy shares from our company you become part of the management board
        </p>

        {dividends.map(item => (
          <div key={item.id} style={cardStyle}>
            <img src={item.img} alt={item.name} style={imgStyle} />

            <div style={{flex: 1}}>
              <p style={{fontSize: '14px', fontWeight: 'bold', color: 'black', marginBottom: '4px'}}>{item.name}</p>
              <p style={labelStyle}>Investment cycle: {item.cycle}</p>
              <p style={labelStyle}>Daily profits: {item.profit}</p>
              <p style={labelStyle}>Minimum deposit: {item.min}</p>
              <p style={labelStyle}>Can buy multiple shares</p>

              {!invested[item.id] ? (
                <button 
                  id={`btn-${item.id}`}
                  style={btnStyle} 
                  onClick={() => handleInvest(item)}
                >
                  Invest now
                </button>
              ) : (
                <button style={{...btnStyle, backgroundColor: '#22c55e', cursor: 'default'}} disabled>
                  Owned
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}