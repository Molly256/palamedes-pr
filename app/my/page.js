'use client'
import { useState, useEffect } from 'react'

const TZ = 'Africa/Kampala'

// Your AvatarWithBadge component
function AvatarWithBadge({ username, vipLevel = 0, size = 76, avatar }) {
 const level = Number(vipLevel?? 0)

 const starColors = {
 0: '#A9A9A9', 1: '#00BFFF', 2: '#FFD700', 3: '#9400D3', 4: '#FF1493',
 5: '#FF4500', 6: '#32CD32', 7: '#FF69B4', 8: '#DC143C', 9: '#8A2BE2', 10: '#FF8C00'
 }

 const starColor = starColors[level] || starColors[0]
 const initial = username? username.charAt(0).toUpperCase() : 'U'

 return (
 <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
 <div style={{
 width: size, height: size, borderRadius: '50%',
 background: avatar? `url(${avatar}) center/cover no-repeat` : '#00BFFF',
 border: '3px solid #00BFFF',
 display: 'flex', alignItems: 'center', justifyContent: 'center',
 fontSize: size * 0.4, fontWeight: '900', color: 'white'
 }}>
 {!avatar && initial}
 </div>
 <div style={{
 position: 'absolute', bottom: -4, left: -4,
 width: size * 0.45, height: size * 0.45,
 filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))', lineHeight: 1, zIndex: 2
 }}>
 <svg width="100%" height="100%" viewBox="0 0 24 24">
 <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
 fill={starColor} stroke="#fff" strokeWidth="1" />
 </svg>
 </div>
 </div>
 )
}

export default function MyPage() {
  const [userData, setUserData] = useState(null)
  const [vipPurchaseDate, setVipPurchaseDate] = useState(null)
  const [transactions, setTransactions] = useState([])

  const getUGDate = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-UG', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(date)
    const y = parts.find(p => p.type === 'year').value
    const m = parts.find(p => p.type === 'month').value
    const d = parts.find(p => p.type === 'day').value
    return new Date(`${y}-${m}-${d}T00:00:00+03:00`)
  }

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-UG', {
      timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric'
    }).format(new Date(date))
  }

  const getVipPeriod = (purchaseDate) => {
    if (!purchaseDate) return null
    const start = new Date(purchaseDate)
    const end = new Date(start)
    end.setFullYear(end.getFullYear() + 1)
    return `Effective date:${formatDate(start)} ~ ${formatDate(end)}`
  }

  const isWeekend = (date) => {
    const day = new Intl.DateTimeFormat('en-UG', {
      timeZone: TZ, weekday: 'short'
    }).format(date)
    return day === 'Sat' || day === 'Sun'
  }

  const calculateEarnings = () => {
    if (!vipPurchaseDate ||!transactions.length) return {
      yesterday: 0, today: 0, thisWeek: 0, thisMonth: 0,
      total: 0, invitation: 0, deposit: 0, balance: 0
    }

    const todayUG = getUGDate()
    const yesterdayUG = new Date(todayUG)
    yesterdayUG.setDate(yesterdayUG.getDate() - 1)

    const weekStartUG = new Date(todayUG)
    const dayOfWeek = todayUG.getDay()
    const daysToMonday = dayOfWeek === 0? 6 : dayOfWeek - 1
    weekStartUG.setDate(todayUG.getDate() - daysToMonday)

    const monthStartUG = new Date(todayUG.getFullYear(), todayUG.getMonth(), 1)
    const vipStart = new Date(vipPurchaseDate)

    let yesterdayAmt = 0, todayAmt = 0, weekAmt = 0, monthAmt = 0, totalAmt = 0, inviteAmt = 0, deposit = 0

    transactions.forEach(tx => {
      const txDateUG = getUGDate(new Date(tx.date))
      if (isWeekend(txDateUG)) return

      if (txDateUG >= vipStart && tx.type === 'task') {
        totalAmt += tx.amount
        if (txDateUG.getTime() === todayUG.getTime()) todayAmt += tx.amount
        if (txDateUG.getTime() === yesterdayUG.getTime()) yesterdayAmt += tx.amount
        if (txDateUG >= weekStartUG) weekAmt += tx.amount
        if (txDateUG >= monthStartUG) monthAmt += tx.amount
      }

      if (txDateUG >= vipStart && tx.type === 'invite_reward') inviteAmt += tx.amount
      if (tx.type === 'vip_purchase') deposit = tx.amount
    })

    if (isWeekend(yesterdayUG)) yesterdayAmt = 0
    if (isWeekend(todayUG)) todayAmt = 0

    const balance = totalAmt + inviteAmt - transactions
     .filter(t => t.type === 'withdraw')
     .reduce((sum, t) => sum + t.amount, 0)

    return { yesterday: yesterdayAmt, today: todayAmt, thisWeek: weekAmt, thisMonth: monthAmt, total: totalAmt, invitation: inviteAmt, deposit, balance }
  }

  const earnings = calculateEarnings()

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    const tx = JSON.parse(localStorage.getItem('transactions') || '[]')
    const vipDate = localStorage.getItem('vip_purchase_date')
    setUserData(user)
    setTransactions(tx)
    setVipPurchaseDate(vipDate)
  }, [])

  // Box styles - hot sky blue + black lightweight text
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
    <div style={{...boxStyle, gridColumn: isBig? 'span 2' : 'span 1'}}>
      <p style={boxTitle}>{title}</p>
      {subtitle && <p style={boxSub}>{subtitle}</p>}
      <p style={boxAmount}>{amount.toLocaleString()}shs</p>
    </div>
  )

  const todayUG = getUGDate()
  const isTodayWeekend = isWeekend(todayUG)

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#f9fafb', padding: '16px', paddingBottom: '96px'}}>
      <div style={{maxWidth: '448px', margin: '0 auto'}}>
        <h1 style={{fontSize: '24px', fontWeight: 'bold', textAlign: 'center', marginBottom: '16px'}}>My</h1>

        {/* Avatar with STAR badge - your component */}
        <div style={{display: 'flex', justifyContent: 'center', marginBottom: '16px'}}>
          <AvatarWithBadge
            username={userData?.username}
            vipLevel={userData?.vip_level || 0}
            avatar={userData?.avatar}
            size={80}
          />
        </div>

        {/* Available Balance - NOW SAME HOT SKY BLUE */}
        <div style={{...boxStyle, marginBottom: '16px'}}>
          <p style={boxTitle}>Available Balance</p>
          <p style={boxAmount}>{earnings.balance.toLocaleString()}shs</p>
        </div>

        {/* Effective Date */}
        {vipPurchaseDate && (
          <p style={{textAlign: 'center', fontSize: '14px', color: '#9ca3af', marginBottom: '16px'}}>
            {getVipPeriod(vipPurchaseDate)}
          </p>
        )}

        {isTodayWeekend && (
          <p style={{textAlign: 'center', fontSize: '12px', color: '#ef4444', marginBottom: '12px'}}>No tasks available on weekends</p>
        )}

        {/* 7 Boxes Grid */}
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