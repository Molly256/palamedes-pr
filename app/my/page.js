'use client'
import { useState, useEffect } from 'react'
import AvatarWithBadge from '../../components/AvatarWithBadge'

const TZ = 'Africa/Kampala'

export default function MyPage() {
  const [userData, setUserData] = useState(null)
  const [vipPurchaseDate, setVipPurchaseDate] = useState(null)
  const [vipPurchaseAmount, setVipPurchaseAmount] = useState(0)
  const [jobSecurity, setJobSecurity] = useState(false)
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
      const res = await fetch(`/api/my?phone=${user.phone}&t=${Date.now()}`)
      const data = await res.json()

      console.log('API response:', data)

      if (data.success) {
        setUserData(data.user)
        setVipPurchaseDate(data.vipPurchaseDate || null)
        setVipPurchaseAmount(data.vipPurchaseAmount || 0)
        setJobSecurity(data.jobSecurity)
      }
    } catch (err) {
      console.error('[MyPage] Load dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    if (isNaN(date)) return ''
    return new Intl.DateTimeFormat('en-UG', {
      timeZone: TZ,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }).format(date)
  }

  const getVipPeriod = () => {
    if (!vipPurchaseDate || (userData?.vip || 0) < 1) return null
    const start = new Date(vipPurchaseDate)
    if (isNaN(start)) return null
    const end = new Date(start)
    end.setFullYear(end.getFullYear() + 1)
    return `Effective date: ${formatDate(start)} ~ ${formatDate(end)}`
  }

  const boxStyle = {
    backgroundColor: '#00BFFF',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    overflow: 'hidden'
  }

  const boxTitle = {
    fontSize: '14px',
    fontWeight: '300',
    color: 'black',
    marginBottom: '4px'
  }

  const boxAmount = {
    fontSize: '24px',
    fontWeight: 'bold',
    color: 'black'
  }

  const periodText = {
    fontSize: '14px',
    color: '#6b7280',
    textAlign: 'center',
    margin: '8px 0',
    fontWeight: '500'
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 0'
      }}>
        Loading...
      </div>
    )
  }

  const balance = Number(userData?.balance) || 0
  const jobSecurityText = jobSecurity? 'Active' : 'Inactive'
  const vipPeriod = getVipPeriod()

  return (
    <div style={{backgroundColor: '#f9fafb', padding: '16px', paddingBottom: '96px'}}>
      <div style={{maxWidth: '448px', margin: '0 auto'}}>
        <h1 style={{
          fontSize: '24px',
          fontWeight: 'bold',
          textAlign: 'center',
          marginBottom: '16px'
        }}>
          My
        </h1>

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

          {/* VIP Effective Period */}
          {vipPeriod && (
            <>
              <p style={periodText}>{vipPeriod}</p>
              {vipPurchaseAmount > 0 && (
                <p style={periodText}>
                  Amount paid: {vipPurchaseAmount.toLocaleString()}shs
                </p>
              )}
            </>
          )}

          {/* Box 2: Job Security */}
          <div style={boxStyle}>
            <p style={boxTitle}>Job Security</p>
            <p style={boxAmount}>{jobSecurityText}</p>
          </div>
        </div>
      </div>
    </div>
  )
}