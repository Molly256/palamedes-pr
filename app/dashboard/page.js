'use client'
import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [avatar, setAvatar] = useState('')
  const [hasViptask, setHasViptask] = useState(false)
  const fileInputRef = useRef(null)
  const router = useRouter()

  useEffect(() => {
    const userData = localStorage.getItem('palamedes_user')
    if (userData) {
      setUser(JSON.parse(userData))
      const savedAvatar = localStorage.getItem('palamedes_avatar')
      if (savedAvatar) setAvatar(savedAvatar)
    } else {
      window.location.href = '/login'
    }
  }, [])

  const handleAvatarClick = () => {
    if (!hasViptask) {
      alert('Change after viptask purchase')
      return
    }
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setAvatar(e.target.result)
        localStorage.setItem('palamedes_avatar', e.target.result)
      }
      reader.readAsDataURL(file)
    }
  }

  if (!user) return <div style={{ textAlign: 'center', padding: '100px' }}>Loading...</div>

  const menuItems = [
    { icon: '💳', label: 'Deposit', href: '/deposit' },
    { icon: '🏧', label: 'Withdraw', href: '/withdraw' }, // <-- added href
    { icon: '💼', label: 'Viptask' },
    { icon: '📜', label: 'Transactions', href: '/transactions' }, // <-- added href
    { icon: '👥', label: 'Invite' },
    { icon: '👨‍👩‍👧', label: 'Myteam' },
    { icon: '📖', label: 'About' },
    { icon: '⚙️', label: 'Settings' },
    { icon: '🎧', label: 'Manager -contact' }
  ]

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f5', padding: '40px 20px' }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto' }}>

        {/* 1 COMPACT CENTERED BOX */}
        <div style={{
          background: '#fff',
          padding: '24px 30px',
          borderRadius: '12px',
          border: '2px solid #87CEEB',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '28px',
          maxWidth: '650px',
          margin: '0 auto 30px auto'
        }}>
          {/* LEFT: User details */}
          <div>
            <h1 style={{ fontSize: '26px', color: '#000', marginBottom: '8px' }}>
              Welcome, {user.username}
            </h1>
            <p style={{ color: '#666', fontSize: '15px', marginBottom: '16px' }}>
              Phone: {user.phone}
            </p>
            <h2 style={{ fontSize: '32px', color: '#87CEEB', fontWeight: '900', marginBottom: '4px' }}>
              UGX {user.balance.toLocaleString()}
            </h2>
            <p style={{ color: '#999', fontSize: '13px' }}>Available Balance</p>
          </div>

          {/* RIGHT: Avatar */}
          <div>
            <div
              onClick={handleAvatarClick}
              style={{
                width: '110px',
                height: '110px',
                borderRadius: '50%',
                background: avatar? `url(${avatar}) center/cover` : '#87CEEB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '44px',
                color: '#fff',
                cursor: 'pointer',
                border: '3px solid #87CEEB',
                flexShrink: 0
              }}
            >
              {!avatar && '👤'}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Icon Buttons Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '15px',
          maxWidth: '650px',
          margin: '0 auto'
        }}>
          {menuItems.map(item => (
            <button
              key={item.label}
              onClick={() => item.href && router.push(item.href)}
              style={{
                padding: '25px 15px',
                background: '#E0F6FF',
                border: '1px solid #87CEEB',
                borderRadius: '12px',
                fontSize: '15px',
                fontWeight: '400',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                color: '#000',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => e.currentTarget.style.background = '#C7EFFF'}
              onMouseOut={(e) => e.currentTarget.style.background = '#E0F6FF'}
            >
              <span style={{ fontSize: '36px' }}>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  )
}