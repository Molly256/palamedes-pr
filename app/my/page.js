'use client'
import { useState, useEffect } from 'react'
import AvatarWithBadge from '../../components/AvatarWithBadge'

const TZ = 'Africa/Kampala'

export default function MyPage() {
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    const stored = localStorage.getItem('palamedes_user')
    if (!stored || stored === 'undefined' || stored === 'null') {
      setLoading(false)
      return
    }

    let user
    try {
      user = JSON.parse(stored)
    } catch {
      localStorage.removeItem('palamedes_user')
      setLoading(false)
      return
    }

    if (!user.phone) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/my?phone=${user.phone}`)
      const data = await res.json()

      if (data.success) {
        setUserData(data.user)
      }
    } catch (err) {
      console.error('[MyPage] Load dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const boxStyle = {
    backgroundColor: '#00BFFF',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  }
  const boxTitle = { fontSize: '14px', fontWeight: '300', color: 'black', marginBottom: '4px' }
  const boxAmount = { fontSize: '24px', fontWeight: 'bold', color: 'black' }

  if (loading) {
    return <div style={{minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0'}}>Loading...</div>
  }

  const balance = Number(userData?.balance) || 0
  const jobSecurity = userData?.jobSecurity? 'Active' : 'Inactive'

  return (
    <div style={{backgroundColor: '#f9fafb', padding: '16px', paddingBottom: '96px'}}>
      <div style={{maxWidth: '448px', margin: '0 auto'}}>
        <h1 style={{fontSize: '24px', fontWeight: 'bold', textAlign: 'center', marginBottom: '16px'}}>My</h1>

        <div style={{display: 'flex', justifyContent: 'center', marginBottom: '16px'}}>
          <AvatarWithBadge
            username={userData?.username}
            vipLevel={userData?.vip || 0}
            avatar={userData?.avatar}
            size={80}
          />
        </div>

        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          {/* Box 1: Available Balance */}
          <div style={boxStyle}>
            <p style={boxTitle}>Available Balance</p>
            <p style={boxAmount}>{balance.toLocaleString()}shs</p>
          </div>

          {/* Box 2: Job Security */}
          <div style={boxStyle}>
            <p style={boxTitle}>Job Security</p>
            <p style={boxAmount}>{jobSecurity}</p>
          </div>
        </div>
      </div>
    </div>
  )
}