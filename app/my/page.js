'use client'
import { useState, useEffect } from 'react'

const TZ = 'Africa/Kampala'

export default function MyPage() {
  const [userData, setUserData] = useState(null)
  const [vipPurchaseDate, setVipPurchaseDate] = useState(null)
  const [transactions, setTransactions] = useState([])

  // Get date parts in Uganda timezone
  const getUGDate = (date = new Date()) => {
    const parts = new Intl.DateTimeFormat('en-UG', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit', 
      day: '2-digit'
    }).formatToParts(date)
    
    const y = parts.find(p => p.type === 'year').value
    const m = parts.find(p => p.type === 'month').value
    const d = parts.find(p => p.type === 'day').value
    
    return new Date(`${y}-${m}-${d}T00:00:00+03:00`)
  }

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-UG', {
      timeZone: TZ,
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    }).format(new Date(date))
  }

  const getVipPeriod = (purchaseDate) => {
    if (!purchaseDate) return null
    const start = new Date(purchaseDate)
    const end = new Date(start)
    end.setFullYear(end.getFullYear() + 1)
    return `Effective date:${formatDate(start)} ~ ${formatDate(end)}`
  }

  const getUGDay = (date) => {
    return new Intl.DateTimeFormat('en-UG', {
      timeZone: TZ,
      weekday: 'short'
    }).format(date)
  }

  // Auto calculation with UG timezone
  const calculateEarnings = () => {
    if (!vipPurchaseDate || !transactions.length) return {
      yesterday: 0, today: 0, thisWeek: 0, thisMonth: 0, 
      total: 0, invitation: 0, deposit: 0, balance: 0
    }

    const nowUG = getUGDate()
    const todayUG = getUGDate()
    const yesterdayUG = new Date(todayUG)
    yesterdayUG.setDate(yesterdayUG.getDate() - 1)
    
    // Week starts Monday in Uganda calendar
    const weekStartUG = new Date(todayUG)
    const dayOfWeek = todayUG.getDay() // 0=Sun, 1=Mon
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    weekStartUG.setDate(todayUG.getDate() - daysToMonday)
    
    const monthStartUG = new Date(todayUG.getFullYear(), todayUG.getMonth(), 1)
    const vipStart = new Date(vipPurchaseDate)

    let yesterdayAmt = 0, todayAmt = 0, weekAmt = 0, monthAmt = 0, totalAmt = 0, inviteAmt = 0, deposit = 0

    transactions.forEach(tx => {
      const txDateUG = getUGDate(new Date(tx.date))
      
      // Only count after VIP purchase
      if (txDateUG >= vipStart && tx.type === 'task') {
        totalAmt += tx.amount
        
        if (txDateUG.getTime() === todayUG.getTime()) todayAmt += tx.amount
        if (txDateUG.getTime() === yesterdayUG.getTime()) yesterdayAmt += tx.amount
        if (txDateUG >= weekStartUG) weekAmt += tx.amount
        if (txDateUG >= monthStartUG) monthAmt += tx.amount
      }
      
      // Invitation rewards - 5% 2% 1%
      if (txDateUG >= vipStart && tx.type === 'invite_reward') {
        inviteAmt += tx.amount
      }
      
      // Job security deposit = VIP level amount
      if (tx.type === 'vip_purchase') {
        deposit = tx.amount
      }
    })

    // Weekend logic: Sat=6, Sun=0 in UG calendar. Monday yesterday = 0
    const yesterdayDay = yesterdayUG.getDay()
    if (yesterdayDay === 0 || yesterdayDay === 6) {
      yesterdayAmt = 0
    }

    // Available balance = all income - withdrawals
    const balance = totalAmt + inviteAmt - transactions
      .filter(t => t.type === 'withdraw')
      .reduce((sum, t) => sum + t.amount, 0)

    return {
      yesterday: yesterdayAmt,
      today: todayAmt,
      thisWeek: weekAmt,
      thisMonth: monthAmt,
      total: totalAmt,
      invitation: inviteAmt,
      deposit: deposit,
      balance: balance
    }
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

  const Box = ({ title, subtitle, amount, isBig = false }) => (
    <div className={`${isBig ? 'col-span-2' : ''} bg-[#00BFFF] rounded-xl p-4 text-center shadow-md`}>
      <p className="text-sm font-light text-black mb-1">{title}</p>
      {subtitle && <p className="text-xs font-light text-black mb-2">{subtitle}</p>}
      <p className="text-2xl font-bold text-black">{amount.toLocaleString()}shs</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-24">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-center mb-4">My</h1>

        {/* Avatar + VIP Badge */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative">
            <img 
              src={userData?.avatar || '/avatar-default.png'} 
              alt="avatar"
              className="w-20 h-20 rounded-full border-4 border-[#00BFFF]"
            />
            {userData?.vip_level && (
              <span className="absolute -bottom-1 -right-1 bg-yellow-400 text-black text-xs font-bold px-2 py-0.5 rounded-full border-2 border-white">
                VIP {userData.vip_level}
              </span>
            )}
          </div>
        </div>

        {/* Available Balance */}
        <div className="bg-white rounded-xl p-4 mb-4 text-center shadow">
          <p className="text-sm text-gray-600">Available Balance</p>
          <p className="text-3xl font-bold text-[#00BFFF]">{earnings.balance.toLocaleString()}shs</p>
        </div>

        {/* Effective Date - Uganda format */}
        {vipPurchaseDate && (
          <p className="text-center text-sm text-gray-400 mb-4">
            {getVipPeriod(vipPurchaseDate)}
          </p>
        )}

        {/* 7 Boxes Grid */}
        <div className="grid grid-cols-2 gap-3">
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