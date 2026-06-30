'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link' 
import AvatarWithBadge from '../../components/AvatarWithBadge'
import Card from '../../components/Card'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
  const router = useRouter()

  // Load from local storage instantly so the screen doesn't flicker or show loading screens
  const [user, setUser] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('palamedes_user')
        return cached ? JSON.parse(cached) : null
      } catch {
        return null
      }
    }
    return null
  })

  const [loading, setLoading] = useState(!user)

  const ADMIN_PHONE = '0753520252'

  const normalizePhone = (phone) => {
    if (!phone) return ''
    phone = String(phone).trim().replace(/\D/g, '')
    if (!/^07\d{8}$/.test(phone)) return ''
    return phone
  }

  const loadUser = async (isFocusEvent = false) => {
    if (typeof window === 'undefined') return

    const cachedData = localStorage.getItem('palamedes_user')
    let localUser = null
    
    try {
      if (cachedData) localUser = JSON.parse(cachedData)
    } catch {
      localUser = null
    }
    
    // SAFE LAYERING: Only kick out to register if there is absolutely NO user data in state AND cache
    if (!localUser && !user) {
      setLoading(false)
      router.replace('/register')
      return
    }

    const currentPhone = localUser?.phone || user?.phone
    const cleanPhone = normalizePhone(currentPhone)

    if (!cleanPhone) {
      if (!user) router.replace('/register')
      return
    }
    
    try {
      // CALLS API USER AS REQUESTED
      const res = await fetch(`/api/user?action=getDashboard&phone=${cleanPhone}&_t=${Date.now()}`)
      const data = await res.json()
      
      if (data.success && data.user) {
        const updatedUser = {
          ...data.user,
          availableBalance: Number(data.user.availableBalance || 0)
        }
        localStorage.setItem('palamedes_user', JSON.stringify(updatedUser))
        setUser(updatedUser)
      }
    } catch (e) {
      console.log('Dashboard sync failed:', e)
      // If server drops or errors out, keep showing the user cached data instead of kicking them out!
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser(false)

    const handleWindowFocus = () => loadUser(true)
    window.addEventListener('focus', handleWindowFocus)
    
    return () => {
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [router])

  const menuItems = [
    { icon: '💳', label: 'Deposit', href: '/deposit' },
    { icon: '🏧', label: 'Withdraw', href: '/withdraw' },
    { icon: '💼', label: 'VIP Levels', href: '/viplevels' },
    { icon: '📜', label: 'Transactions', href: '/transactions' },
    { icon: '👥', label: 'Invite', href: '/invite' },
    { icon: '👨‍👩‍👧', label: 'Myteam', href: '/myteam' },
    { icon: '📖', label: 'About', href: '/about' },
    { icon: '📱', label: 'Download App', href: '/downloadapp' },
    { icon: '🎧', label: 'Manager', href: '/manager' }
  ]

  const displayBalance = Number(user?.availableBalance || 0)
  const vipLevel = Number(user?.vip || 0)
  const vipName = vipLevel > 0 ? `VIP ${vipLevel}` : 'Internship'

  return (
    <Card>
      <main style={{
        minHeight: 'auto',
        background: '#FFFFFF',
        padding: '15px 20px 0',
        boxSizing: 'border-box'
      }}>

        <div style={{ 
          background: '#FFFFFF',
          border: '1px solid #E0E0E0',
          borderRadius: '20px',
          padding: '20px 15px',
          marginBottom: '25px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          position: 'relative',
          minHeight: '140px'
        }}>
          
          <div style={{ paddingRight: '90px' }}>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#00BFFF' }}>
              Welcome to PALAMEDES PR
            </h2>
            <p style={{ margin: '8px 0 0', fontSize: '16px', fontWeight: '800', color: '#000' }}>
              Username: {user?.username || 'User'}
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '16px', fontWeight: '800', color: '#000' }}>
              Phone number: {user?.phone || 'Not registered'}
            </p>
            <p style={{ margin: '12px 0 4px', fontSize: '14px', fontWeight: '800', color: '#000' }}>
              Available balance
            </p>
            <p style={{ margin: '0', fontSize: '32px', fontWeight: '900', color: '#000' }}>
              {displayBalance.toLocaleString()} shs
            </p>
            <p style={{ margin: '6px 0 0', fontSize: '14px', fontWeight: '700', color: '#000' }}>
              {vipName}
            </p>
          </div>

          <div style={{ position: 'absolute', top: '20px', right: '18px' }}>
            <AvatarWithBadge username={user?.username} vipLevel={vipLevel} size={72} avatar={user?.avatar || ''} />
          </div>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '18px 15px',
          marginBottom: '18px'
        }}>
          {menuItems.map(item => (
            <Link key={item.label} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ 
                  width: '100%',
                  height: '95px',
                  background: '#00BFFF', 
                  borderRadius: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '28px',
                  color: '#000'
                }}>
                  {item.icon}
                </div>
                <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: '900', color: '#000', lineHeight: '1.2' }}>
                  {item.label}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {normalizePhone(user?.phone) === ADMIN_PHONE && (
          <div 
            onClick={() => router.push('/admin')}
            style={{ 
              width: '100%',
              height: '95px',
              background: '#FF69B4', 
              borderRadius: '14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              color: '#000',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(255,105,180,0.3)',
              marginBottom: '60px'
            }}
          >
            🛡️
            <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: '900', color: '#000', lineHeight: '1.2' }}>
              Admin Panel
            </p>
          </div>
        )}

      </main>
    </Card>
  )
}