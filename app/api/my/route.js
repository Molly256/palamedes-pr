import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

const TZ = 'Africa/Kampala'

function safeParse(val) {
  if (!val || val === '' || val === 'null' || val === 'undefined') return null
  if (typeof val === 'object') return val
  try {
    let parsed = val
    for (let i = 0; i < 2; i++) {
      if (typeof parsed === 'string') parsed = JSON.parse(parsed)
      else break
    }
    return parsed
  } catch { return null }
}

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')
  if (phone.length === 9 && !phone.startsWith('0')) phone = '0' + phone
  return phone
}

function getDateRanges() {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
  
  const startToday = new Date(now)
  startToday.setHours(0, 0, 0, 0)
  
  const startYesterday = new Date(startToday)
  startYesterday.setDate(startToday.getDate() - 1)
  
  const startWeek = new Date(startToday)
  startWeek.setDate(startToday.getDate() - startToday.getDay())
  
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  
  return {
    today: startToday.getTime(),
    yesterday: startYesterday.getTime(),
    week: startWeek.getTime(),
    month: startMonth.getTime()
  }
}

async function getUserData(phone) {
  const userKey = `user:${phone}`
  if ((await kv.type(userKey)) === 'hash') {
    const user = await kv.hgetall(userKey)
    return { user, userKey }
  }
  return { user: null, userKey: null }
}

async function getTransactions(phone) {
  const key = `transactions:${phone}`
  if ((await kv.type(key)) !== 'list') return []
  const raw = await kv.lrange(key, 0, 199)
  return raw.map(t => safeParse(t)).filter(Boolean)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    let phone = normalizePhone(searchParams.get('phone'))
    if (!phone) return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })

    const { user } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const transactions = await getTransactions(phone)
    const recentTx = transactions.slice(0, 49)
    const vipTx = transactions.find(t => t.type === 'viptask_purchase')
    const ranges = getDateRanges()

    let availableBalance = Number(user.balance) || 0
    let todayIncome = 0
    let yesterdayIncome = 0
    let thisWeekIncome = 0
    let thisMonthIncome = 0
    let totalRevenue = 0
    let invitationRewardA = 0
    let invitationRewardB = 0
    let invitationRewardC = 0

    for (const tx of transactions) {
      const amount = Number(tx.amount) || 0
      const time = new Date(tx.time || tx.createdAt || Date.now()).getTime()
      const type = tx.type

      if (type === 'task_reward' || type === 'deposit' || type === 'invitation_reward') {
        totalRevenue += amount
        if (time >= ranges.month) thisMonthIncome += amount
        if (time >= ranges.week) thisWeekIncome += amount
        if (time >= ranges.today) todayIncome += amount
        if (time >= ranges.yesterday && time < ranges.today) yesterdayIncome += amount
      }

      if (type === 'invitation_reward') {
        if (tx.level === 'A' || tx.level === 1) invitationRewardA += amount
        if (tx.level === 'B' || tx.level === 2) invitationRewardB += amount
        if (tx.level === 'C' || tx.level === 3) invitationRewardC += amount
      }
    }

    const createdAt = new Date(user.createdAt || Date.now()).getTime()
    const daysActive = (Date.now() - createdAt) / (1000 * 60 * 60 * 24)
    const jobSecurity = Number(user.vip) >= 3 && daysActive >= 7

    return NextResponse.json({
      success: true,
      user: {
        username: user.username || '',
        phone: user.phone || phone,
        balance: availableBalance,
        vip: Number(user.vip) || 0,
        avatar: user.avatar || '',
        nickname: user.nickname || '',
        vipLocked: user.vipLocked === 'true',
        tasksCompleted: Number(user.tasksCompleted) || 0,
        vipPricePaid: Number(user.vipPricePaid) || 0,
        referralPaid: user.referralPaid || 'false',
        vip_commission_paid: user.vip_commission_paid || 'false',
        upline1: user.upline1 || '',
        upline2: user.upline2 || '',
        upline3: user.upline3 || '',
        createdAt: user.createdAt || ''
      },
      transactions: recentTx,
      vipPurchaseDate: vipTx?.date || null,
      
      availableBalance,
      todayIncome,
      yesterdayIncome,
      thisWeekIncome,
      thisMonthIncome,
      totalRevenue,
      invitationRewardA,
      invitationRewardB,
      invitationRewardC,
      jobSecurity
    })
  } catch (err) {
    console.error('GET /api/my error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}