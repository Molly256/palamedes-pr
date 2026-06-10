'use client'
import { useState, useEffect } from 'react'
import AvatarWithBadge from '../../components/AvatarWithBadge'

const TZ = 'Africa/Kampala'

export default function MyPage() {
  const [userData, setUserData] = useState(null)
  const [vipPurchaseDate, setVipPurchaseDate] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)

  const getUGDate = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-UG', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date)
    const y = parts.find(p => p.type === 'year').value
    const m = parts.find(p => p.type === 'month').value
    const d = parts.find(p => p.type === 'day').value
    return new Date(`${y}-${m}-${d}T00:00:00+03:00`)
  }

  // Parse "10/10/2026 14:30:25" to Date
  const parseTxDate = (dateStr) => {
    if (!dateStr) return null
    const [datePart, timePart] = dateStr.split(' ')
    const [day, month, year] = datePart.split('/')
    return new Date(`${year}-${month}-${day}T${timePart}+03:00`)
  }

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-UG', {
      timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(new Date(date))
  }

  const getVipPeriod = (purchaseDateStr) => {
    if (!purchaseDateStr) return null
    const start = parseTxDate(purchaseDateStr)
    if (!start) return null
    const end = new Date(start)
    end.setFullYear(end.getFullYear() + 1)
    return `Effective date: ${formatDate(start)} ~ ${formatDate(end)}`
  }

  const isWeekend = (date) => {
    const day = new Intl.DateTimeFormat('en-UG', {
      timeZone: TZ, weekday: 'short'
    }).format(date)
    return day === 'Sat' || day === 'Sun'
  }

  const calculateEarnings = () => {
    if (!vipPurchaseDate || !transactions.length) return {
      yesterday: 0, today: 0, thisWeek: 0, thisMonth: 0,
      total: 0, invitation: 0, deposit: 0, balance: userData?.balance || 0
    }

    const todayUG = getUGDate()
    const yesterdayUG = new Date(todayUG)
    yesterdayUG.setDate(yesterdayUG.getDate() - 1)

    const weekStartUG = new Date(todayUG)
    const dayOfWeek = todayUG.getDay()
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    weekStartUG.setDate(todayUG.getDate() - daysToMonday)

    const monthStartUG = new Date(todayUG.getFullYear(), todayUG.getMonth(), 1)
    const vipStart = parseTxDate(vipPurchaseDate)

    let yesterdayAmt = 0, todayAmt = 0, weekAmt = 0, monthAmt = 0, totalAmt = 0, inviteAmt = 0, deposit = 0

    transactions.forEach(tx => {
      const txDate = parseTxDate(tx.date)
      if (!txDate) return
      const txDateUG = getUGDate(txDate)
      
      if (isWeekend(txDateUG)) return

      if (txDateUG >= vipStart && tx.type === 'task') {
        totalAmt += tx.amount
        if (txDateUG.getTime() === todayUG.getTime()) todayAmt += tx.amount
        if (txDateUG.getTime() === yesterdayUG.getTime()) yesterdayAmt += tx.amount
        if (txDateUG >= weekStartUG) weekAmt += tx.amount
        if (txDateUG >= monthStartUG) monthAmt += tx.amount
      }

      if (txDateUG >= vipStart && tx.type === 'invite_reward') inviteAmt += tx.amount
      if (tx.type === 'vip') deposit = Math.abs(tx.amount)
    })

    if (isWeekend(yesterdayUG)) yesterdayAmt = 0
    if (isWeekend(todayUG)) todayAmt = 0

    const balance = userData?.balance || 0

    return { yesterday: yesterdayAmt, today: todayAmt, thisWeek: weekAmt, thisMonth: monthAmt, total: totalAmt, invitation: inviteAmt, deposit, balance }
  }

  const earnings = calculateEarnings()

  useEffect(() => {
    loadDashboard()
  }, [])

  const loadDashboard = async () => {
    const user = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!user.phone) {
      setLoading(false)
      return
    }

    try {
      const res = await fetch(`/api/user?action=getDashboard&phone=${user.phone}`)
      const data = await res.json()

      if (data.success) {
        setUserData(data.user)
        setTransactions(data.transactions || [])
        setVipPurchaseDate(data.vipPurchaseDate)
      }
    } catch (err) {
      console.error('Load dashboard error:', err)
    } finally {
      setLoading(false)
    }
  }

  const boxStyle = {
    backgroundColor: '#00BFFF',
    borderRadius: '12px',
    padding: '16px',
    textAlign: 'center',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
  }
  const boxTitle = { fontSize: '14px', fontWeight: '300', color: 'black', marginBottom: '4px' }
  const boxSub = { fontSize: '12px', fontWeight: '300', color: 'black', marginBottom: '8px' }
  const boxAmount = { fontSize: '24px', fontWeight: 'bold', color: 'black' }

  const Box = ({ title, subtitle, amount, isBig = false }) => (
    <div style={{...boxStyle, gridColumn: isBig ? 'span 2' : 'span 1'}}>
      <p style={boxTitle}>{title}</p>
      {subtitle && <p style={boxSub}>{subtitle}</p>}
      <p style={boxAmount}>{amount.toLocaleString()}shs</p>
    </div>
  )

  const todayUG = getUGDate()
  const isTodayWeekend = isWeekend(todayUG)

  if (loading) {
    return <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>Loading...</div>
  }

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#f9fafb', padding: '16px', paddingBottom: '96px'}}>
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

        <div style={{...boxStyle, marginBottom: '16px'}}>
          <p style={boxTitle}>Available Balance</p>
          <p style={boxAmount}>{earnings.balance.toLocaleString()}shs</p>
        </div>

        {vipPurchaseDate && (
          <p style={{textAlign: 'center', fontSize: '14px', color: '#9ca3af', marginBottom: '16px'}}>
            {getVipPeriod(vipPurchaseDate)}
          </p>
        )}

        {isTodayWeekend && (
          <p style={{textAlign: 'center', fontSize: '12px', color: '#ef4444', marginBottom: '12px'}}>No tasks available on weekends</p>
        )}

        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px'}}>
          <Box title="Yesterday's income" amount={earnings.yesterday} />
          <Box title="Today's income" amount={earnings.today} />
          <Box title="This month's income" amount={earnings.thisMonth} />
          <Box title="This week's income" amount={earnings.thisWeek} />
          <Box title="Total revenue" amount={earnings.total} />
          <Box title="Invitation reward" subtitle="(5%-2%-1%)" amount={earnings.invitation} />
          <Box title="Job security deposit" amount={earnings.deposit} isBig={true} />
        </div>
      </div>
    </div>
  )
}