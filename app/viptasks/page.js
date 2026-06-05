'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function VipTask() {
  const [user, setUser] = useState(null)
  const [showBuyPopup, setShowBuyPopup] = useState(false)
  const [selectedVip, setSelectedVip] = useState(null)
  const [books, setBooks] = useState([])
  const [activeBook, setActiveBook] = useState(null)
  const [timer, setTimer] = useState(10)

  // VIP config - colors + rewards
  const vips = [
    { level: 0, name: 'VIP 0.Internship', price: 0, books: 4, perBook: 625, color: '#e0e0e0', badge: '💎' },
    { level: 1, name: 'VIP 1', price: 80000, books: 4, perBook: 625, color: '#87CEEB', badge: '💎' },
    { level: 2, name: 'VIP 2', price: 250000, books: 4, perBook: 2000, color: '#FFFACD', badge: '💎' },
    { level: 3, name: 'VIP 3', price: 790000, books: 4, perBook: 6500, color: '#DDA0DD', badge: '💎' },
    { level: 4, name: 'VIP 4', price: 1000000, books: 5, perBook: 7000, color: '#FFB6C1', badge: '💎', locked: true },
    { level: 5, name: 'VIP 5', price: 1500000, books: 5, perBook: 10000, color: '#FFDAB9', badge: '💎', locked: true },
    { level: 6, name: 'VIP 6', price: 2100000, books: 5, perBook: 14000, color: '#90EE90', badge: '💎', locked: true },
    { level: 7, name: 'VIP 7', price: 4000000, books: 5, perBook: 28000, color: '#FFC0CB', badge: '💎', locked: true },
    { level: 8, name: 'VIP 8', price: 4600000, books: 5, perBook: 32000, color: '#CD5C5C', badge: '💎', locked: true },
    { level: 9, name: 'VIP 9', price: 5000000, books: 5, perBook: 40000, color: '#D3D3D3', badge: '💎', locked: true },
    { level: 10, name: 'VIP 10', price: 8000000, books: 5, perBook: 60000, color: '#DAA520', badge: '💎', locked: true },
  ]

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    setUser(userData)

    // Auto assign VIP 0 free on first register
    if (!userData.vip || userData.vip === 0) {
      userData.vip = 0
      userData.tasksCompleted = 0
      localStorage.setItem('palamedes_user', JSON.stringify(userData))
      setUser(userData)
    }

    loadDailyBooks(userData.vip || 0)
  }, [])

  const loadDailyBooks = (vipLevel) => {
    const vip = vips.find(v => v.level === vipLevel)
    if (!vip) return

    // Generate 4-5 fake books for today - same for all users
    const today = new Date().toISOString().split('T')[0]
    const bookList = Array.from({ length: vip.books }, (_, i) => ({
      id: i + 1,
      title: `Book ${i + 1} - Daily Task`,
      reward: vip.perBook,
      completed: false
    }))
    setBooks(bookList)
  }

  const handleBuyVip = (vip) => {
    if (vip.locked) {
      alert('Coming soon')
      return
    }
    if (vip.level === user.vip) {
      alert('You already have this VIP')
      return
    }
    setSelectedVip(vip)
    setShowBuyPopup(true)
  }

  const confirmBuy = () => {
    const currentBalance = user.balance || 0

    if (currentBalance < selectedVip.price) {
      alert('Insufficient balance')
      setShowBuyPopup(false)
      return
    }

    // Refund previous VIP if upgrading
    const prevVip = vips.find(v => v.level === user.vip)
    const newBalance = currentBalance - selectedVip.price + (prevVip? prevVip.price : 0)

    const updatedUser = {
     ...user,
      vip: selectedVip.level,
      balance: newBalance,
      tasksCompleted: 0
    }

    localStorage.setItem('palamedes_user', JSON.stringify(updatedUser))
    setUser(updatedUser)
    setShowBuyPopup(false)
    alert('VIP activated successfully')
    loadDailyBooks(selectedVip.level)
  }

  const openBook = (book) => {
    if (book.completed) return
    setActiveBook(book)
    setTimer(10)

    const countdown = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          clearInterval(countdown)
          claimReward(book)
          return 10
        }
        return prev - 1
      })
    }, 1000)
  }

  const claimReward = (book) => {
    const updatedBooks = books.map(b =>
      b.id === book.id? {...b, completed: true} : b
    )
    setBooks(updatedBooks)
    setActiveBook(null)

    const newBalance = (user.balance || 0) + book.reward
    const updatedUser = {...user, balance: newBalance}
    localStorage.setItem('palamedes_user', JSON.stringify(updatedUser))
    setUser(updatedUser)

    alert(`Earn reward: +${book.reward} UGX`)
  }

  const isWeekend = () => {
    const day = new Date().getDay()
    return day === 0 || day === 6 // Sunday=0, Saturday=6
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f8f9fa', padding: '20px' }}>

      {/* User avatar with VIP badge */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: '#87CEEB',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
            color: 'white'
          }}>
            {user?.username?.[0]?.toUpperCase() || 'U'}
          </div>
          {user?.vip!== undefined && (
            <div style={{
              position: 'absolute',
              right: '-5px',
              bottom: '-5px',
              background: vips[user.vip].color,
              borderRadius: '50%',
              width: '24px',
              height: '24px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              border: '2px solid white'
            }}>
              {vips[user.vip].badge}
            </div>
          )}
        </div>
        <div style={{ marginLeft: '15px' }}>
          <p style={{ margin: 0, fontWeight: '700' }}>Balance: {user?.balance?.toLocaleString() || 0} UGX</p>
          <p style={{ margin: 0, fontSize: '14px', color: '#666' }}>{vips[user?.vip || 0].name}</p>
        </div>
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px' }}>VIP Levels</h2>

      {/* VIP Cards */}
      <div style={{ display: 'grid', gap: '12px', marginBottom: '40px' }}>
        {vips.map(vip => (
          <div key={vip.level} style={{
            background: vip.color,
            padding: '16px',
            borderRadius: '12px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            opacity: vip.level > 3? 0.7 : 1
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: '700', fontSize: '16px' }}>
                {vip.name} {vip.level >= 4 && '🔒'}
              </p>
              <p style={{ margin: '4px 0 0', fontSize: '13px' }}>
                Daily tasks: {vip.books} books @ {vip.perBook.toLocaleString()}shs
              </p>
              {vip.price > 0 && <p style={{ margin: '4px 0 0', fontWeight: '600' }}>{vip.price.toLocaleString()}shs</p>}
            </div>
            {vip.level!== user?.vip && (
              <button
                onClick={() => handleBuyVip(vip)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '50px',
                  border: 'none',
                  background: 'white',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                BUY
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Daily Tasks */}
      <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '15px' }}>
        Today Tasks {isWeekend() && '(Weekend - No tasks)'}
      </h2>

      {!isWeekend() && books.map(book => (
        <div key={book.id} style={{
          background: book.completed? '#d4edda' : 'white',
          padding: '16px',
          borderRadius: '10px',
          marginBottom: '10px',
          cursor: book.completed? 'default' : 'pointer',
          border: '2px solid #e0e0e0'
        }} onClick={() => openBook(book)}>
          <p style={{ margin: 0, fontWeight: '600' }}>
            {book.title} {book.completed && '✓'}
          </p>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#666' }}>
            Reward: {book.reward.toLocaleString()} UGX
          </p>
        </div>
      ))}

      {/* Book Timer Popup */}
      {activeBook && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '16px',
            textAlign: 'center'
          }}>
            <h3 style={{ marginBottom: '20px' }}>Reading: {activeBook.title}</h3>
            <p style={{ fontSize: '48px', fontWeight: '900', color: '#87CEEB' }}>{timer}s</p>
            <p>Read for 10 seconds to earn reward</p>
          </div>
        </div>
      )}

      {/* Buy Confirmation Popup */}
      {showBuyPopup && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'white',
            padding: '30px',
            borderRadius: '16px',
            textAlign: 'center',
            maxWidth: '320px'
          }}>
            <h3>Do you want to BUY {selectedVip?.name}?</h3>
            <p>Price: {selectedVip?.price.toLocaleString()} UGX</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button onClick={() => setShowBuyPopup(false)} style={{
                flex: 1,
                padding: '12px',
                borderRadius: '50px',
                border: '2px solid #ccc',
                background: 'white',
                fontWeight: '600'
              }}>No</button>
              <button onClick={confirmBuy} style={{
                flex: 1,
                padding: '12px',
                borderRadius: '50px',
                border: 'none',
                background: 'linear-gradient(135deg, #87CEEB 0%, #00BFFF 100%)',
                color: 'white',
                fontWeight: '700'
              }}>OK</button>
            </div>
          </div>
        </div>
      )}

      <Link href="/dashboard" style={{ display: 'block', textAlign: 'center', marginTop: '30px', color: '#00BFFF' }}>
        ← Back to Dashboard
      </Link>
    </main>
  )
}