'use client'
import { useState, useEffect } from 'react'

const TZ = 'Africa/Kampala'
const SHARE_PRICE = 50000

const cardStyle = {
  backgroundColor: 'white',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '12px',
  marginBottom: '12px'
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
  fontSize: '13px'
}
const labelStyle = { fontSize: '13px', fontWeight: '300', color: 'black', marginBottom: '2px' }

const getUGNow = () => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
}

const getUGDateStr = (date = new Date()) => {
  return new Intl.DateTimeFormat('en-UG', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).format(date)
}

const getDaysLeft = (endDateStr) => {
  const now = getUGNow()
  const end = new Date(endDateStr)
  const diff = end - now
  if (diff <= 0) return 0
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

export default function HotPage() {
  const [phone, setPhone] = useState('')
  const [ongoing, setOngoing] = useState([])
  const [expired, setExpired] = useState([])
  const [qtySelector, setQtySelector] = useState(null)
  const [loading, setLoading] = useState(true)

  const dividends = [
    { id: 'pride', name: 'PRIDE AND PREJUDICE', cycle: 30, profit: 1, min: '50,000shs', img: '/images/pride.jpg' },
    { id: 'hegel', name: 'Hegel lectures', cycle: 120, profit: 3, min: '50,000shs', img: '/images/hegel.jpg' },
    { id: 'whale', name: 'The whale', cycle: 180, profit: 5, min: '50,000shs', img: '/images/whale.jpg' }
  ]

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    setPhone(userData.phone || '')
    loadData(userData.phone)
    
    const interval = setInterval(() => setOngoing(prev => [...prev]), 60000)
    return () => clearInterval(interval)
  }, [])

  const loadData = async (userPhone) => {
    if (!userPhone) return
    try {
      const res = await fetch(`/api/user?action=getShares&phone=${userPhone}`)
      const data = await res.json()
      if (data.success) {
        const allShares = data.shares || []
        setOngoing(allShares.filter(s => s.status === 'ongoing'))
        setExpired(allShares.filter(s => s.status === 'expired'))
      }
    } catch (err) {
      console.error('Load shares error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBuy = async (item, quantity) => {
    if (!phone) {
      alert('Please login first')
      return
    }

    const totalCost = SHARE_PRICE * quantity
    
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'buyShare',
          phone: phone,
          shareId: item.id,
          shareName: item.name,
          quantity: quantity,
          totalCost: totalCost,
          cycleDays: item.cycle,
          dailyProfit: item.profit
        })
      })
      const data = await res.json()

      if (data.success) {
        alert(`Success! Bought ${quantity} share(s). New balance: ${data.balance.toLocaleString()}shs`)
        setQtySelector(null)
        loadData(phone)
        
        const user = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
        user.balance = data.balance
        localStorage.setItem('palamedes_user', JSON.stringify(user))
      } else {
        alert(data.message)
      }
    } catch (err) {
      alert('Network error. Try again')
    }
  }

  const handleCollect = async (shareId) => {
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          action: 'collectShare',
          phone: phone,
          shareId: shareId
        })
      })
      const data = await res.json()
      if (data.success) {
        alert(`Collected ${data.profit.toLocaleString()}shs! New balance: ${data.balance.toLocaleString()}shs`)
        const user = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
        user.balance = data.balance
        localStorage.setItem('palamedes_user', JSON.stringify(user))
        loadData(phone)
      } else {
        alert(data.message)
      }
    } catch (err) {
      alert('Network error')
    }
  }

  const openQtySelector = (item) => {
    setQtySelector({ id: item.id, qty: 1, item })
  }

  const renderQtySelector = () => {
    if (!qtySelector) return null
    const item = qtySelector.item
    const total = SHARE_PRICE * qtySelector.qty

    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', zIndex: 1000
      }}>
        <div style={{ background: 'white', padding: '20px', borderRadius: '12px', width: '90%', maxWidth: '320px' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: '16px', fontWeight: 'bold' }}>{item.name}</h3>
          <p style={{ margin: '0 0 16px', fontSize: '14px' }}>Price per share: 50,000shs</p>
          
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px', marginBottom: '16px' }}>
            <button 
              onClick={() => setQtySelector({ ...qtySelector, qty: Math.max(1, qtySelector.qty - 1) })}
              style={{ ...btnStyle, padding: '8px 16px', fontSize: '18px' }}
            >-</button>
            <span style={{ fontSize: '20px', fontWeight: 'bold' }}>{qtySelector.qty}</span>
            <button 
              onClick={() => setQtySelector({ ...qtySelector, qty: qtySelector.qty + 1 })}
              style={{ ...btnStyle, padding: '8px 16px', fontSize: '18px' }}
            >+</button>
          </div>

          <p style={{ textAlign: 'center', fontSize: '16px', fontWeight: 'bold', marginBottom: '16px' }}>
            Total: {total.toLocaleString()}shs
          </p>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={() => setQtySelector(null)}
              style={{ ...btnStyle, backgroundColor: '#e5e7eb', flex: 1 }}
            >Cancel</button>
            <button 
              onClick={() => handleBuy(item, qtySelector.qty)}
              style={{ ...btnStyle, flex: 1 }}
            >Confirm Buy</button>
          </div>
        </div>
      </div>
    )
  }

  const renderShareCard = (share, isOngoing) => {
    const daysLeft = getDaysLeft(share.endDate)
    const product = dividends.find(d => d.id === share.shareId)
    const totalCost = SHARE_PRICE * share.quantity
    const totalProfit = Math.round(SHARE_PRICE * share.quantity * (share.dailyProfit / 100) * share.cycleDays)

    return (
      <div key={share.id} style={cardStyle}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <img src={product?.img} alt={share.shareName} style={imgStyle} />
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>
              {share.shareName} x{share.quantity}
            </p>
            <p style={labelStyle}>Bought: {share.buyDate}</p>
            <p style={labelStyle}>Investment: {totalCost.toLocaleString()}shs</p>
            <p style={labelStyle}>Total profit: {totalProfit.toLocaleString()}shs</p>
            
            {isOngoing ? (
              <>
                <p style={labelStyle}>Expires in: {daysLeft} day(s)</p>
                <button 
                  style={{ 
                    ...btnStyle, 
                    backgroundColor: daysLeft === 0 ? '#22c55e' : '#9ca3af',
                    marginTop: '8px',
                    cursor: daysLeft === 0 ? 'pointer' : 'not-allowed'
                  }}
                  onClick={() => daysLeft === 0 && handleCollect(share.id)}
                  disabled={daysLeft > 0}
                >
                  {daysLeft > 0 ? `Collect in ${daysLeft}d` : 'Collect Profits'}
                </button>
              </>
            ) : (
              <>
                <p style={{ ...labelStyle, color: '#22c55e' }}>Expired</p>
                <p style={labelStyle}>Collected: {share.collectedAt}</p>
                <p style={labelStyle}>Profit received: {share.profitReceived?.toLocaleString()}shs</p>
              </>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', paddingBottom: '96px' }}>
      <h1 style={{ fontSize: '20px', fontWeight: 'bold', textAlign: 'center', padding: '16px', backgroundColor: 'white', borderBottom: '1px solid #e5e7eb' }}>
        PALAMEDES PR COMPANY
      </h1>

      <div style={{ padding: '16px' }}>
        <p style={{ fontSize: '14px', color: 'black', textAlign: 'center', marginBottom: '16px' }}>
          Buy dividends and increase your monthly income<br/>
          When you buy shares you become part of the management board
        </p>

        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>Available Shares</h2>
        {dividends.map(item => (
          <div key={item.id} style={cardStyle}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <img src={item.img} alt={item.name} style={imgStyle} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '4px' }}>{item.name}</p>
                <p style={labelStyle}>Cycle: {item.cycle} days</p>
                <p style={labelStyle}>Daily profit: {item.profit}%</p>
                <p style={labelStyle}>Price: 50,000shs per share</p>
                <button 
                  style={{ ...btnStyle, marginTop: '6px' }}
                  onClick={() => openQtySelector(item)}
                >
                  Invest now
                </button>
              </div>
            </div>
          </div>
        ))}

        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>
          Ongoing Shares
        </h2>
        {ongoing.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', padding: '20px 0' }}>No ongoing shares</p>
        ) : (
          ongoing.map(s => renderShareCard(s, true))
        )}

        <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '24px', marginBottom: '12px' }}>
          Expired Shares
        </h2>
        {expired.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#6b7280', fontSize: '14px', padding: '20px 0' }}>No expired shares</p>
        ) : (
          expired.map(s => renderShareCard(s, false))
        )}
      </div>

      {renderQtySelector()}
    </div>
  )
}