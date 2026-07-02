export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { VIPS } from '@/app/config/vips'

const redis = Redis.fromEnv()

const safeParse = (s, fallback = []) => {
  if (!s) return fallback
  if (typeof s === 'object') return s
  try { return JSON.parse(s) } catch { return fallback }
}

function shuffle(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// Outputs full 4-digit year format (e.g., 2026-07-02)
function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

// Outputs full time structure (e.g., 2026-07-02 14:32)
function getUgandaDateTimeString() {
  return new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).slice(0,16).replace(',', ' ')
}

async function assignBooksToUser(phone, vipLevel, today, pipeline) {
  const selectedVip = VIPS[vipLevel]
  const booksPath = path.join(process.cwd(), 'app/data/books.json')
  const coversDir = path.join(process.cwd(), 'public/books/covers')

  const [allBooks, coverFiles] = await Promise.all([
    fs.readFile(booksPath, 'utf8').then(JSON.parse),
    fs.readdir(coversDir)
  ])

  const coverIds = new Set(
    coverFiles.map(f => f.replace(/\.jpg$/i, '')).filter(id => /^\d+$/.test(id))
  )

  const validBooks = allBooks.filter(b => coverIds.has(String(b.id)))
  if (validBooks.length === 0) throw new Error('No books with covers found')

  const shuffled = shuffle(validBooks)
  const booksToAssign = shuffled.slice(0, Math.min(selectedVip.books, validBooks.length))
  const unlockedBooks = booksToAssign.map(b => String(b.id))
  const assignedBooksMeta = booksToAssign.map(b => ({
    id: String(b.id), title: b.title, cover: `/books/covers/${b.id}.jpg`, reward: selectedVip.perBook
  }))

  booksToAssign.forEach(b => {
    const bookId = String(b.id)
    const bookKey = `book:${phone}:${today}:${bookId}`
    pipeline.hset(bookKey, {
      phone, bookId, vipLevel: String(vipLevel), reward: selectedVip.perBook,
      title: b.title, cover: `/books/covers/${bookId}.jpg`, status: 'pending',
      date: today, createdAt: String(Date.now())
    })
    pipeline.sadd(`books:${phone}:${today}`, bookId)
  })

  return { unlockedBooks, assignedBooksMeta }
}

export async function GET() {
  const levels = Object.keys(VIPS).map(k => ({ level: Number(k),...VIPS[k] }))
  return NextResponse.json({ success: true, levels }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req) {
  try {
    const { phone, action, payload } = await req.json() 
    if (!phone || action!== 'BUY_VIP') return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })

    const vipLevel = payload?.vipLevel
    if (!vipLevel) return NextResponse.json({ success: false, message: 'Missing VIP level' }, { status: 400 })

    const userKey = `user:${phone}`
    const user = await redis.hgetall(userKey)
    if (!user?.phone) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const selectedVip = VIPS[vipLevel]
    if (!selectedVip) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

    const currentVip = Number(user.vip || 0)
    if (vipLevel <= currentVip) return NextResponse.json({ success: false, message: 'You already have this VIP or higher' }, { status: 400 })
    if (vipLevel > 3) return NextResponse.json({ success: false, message: 'VIP 4-10 is locked' }, { status: 400 }) 

    const currentPricePaid = Number(user.vipPricePaid || 0)
    const upgradeCost = selectedVip.price 
    const currentBalance = Number(user.availableBalance || 0)
    if (currentBalance < upgradeCost) return NextResponse.json({ success: false, message: 'Insufficient Available Balance' }, { status: 400 })

    const isFirstTimePurchase = user.hasBoughtVip!== 'true' && user.hasBoughtVip!== true
    let newBalance = currentBalance - upgradeCost 

    const dateStr = getUgandaDateString() 
    const timeStr = getUgandaDateTimeString() 
    const txKey = `tx:${phone}:${dateStr}` 

    const pipeline = redis.pipeline()
    let unlockedBooks = safeParse(user.unlockedBooks)
    let assignedBooksMeta = []

    if (isFirstTimePurchase) {
      const assignedData = await assignBooksToUser(phone, vipLevel, dateStr, pipeline)
      unlockedBooks = assignedData.unlockedBooks
      assignedBooksMeta = assignedData.assignedBooksMeta

      pipeline.lpush(txKey, JSON.stringify({
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'buy_vip', 
        amount: String(-selectedVip.price),
        note: `${selectedVip.name} Purchase`,
        status: 'completed',
        createdAt: timeStr, 
        payload: { vipLevel, books: selectedVip.books, perBook: selectedVip.perBook }
      }))
    } else {
      newBalance = newBalance + currentPricePaid

      pipeline.lpush(txKey, JSON.stringify({
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'refund_vip', 
        amount: String(currentPricePaid),
        note: `VIP ${currentVip} Refund`,
        status: 'completed',
        createdAt: timeStr, 
        payload: { vipLevel: currentVip }
      }))

      pipeline.lpush(txKey, JSON.stringify({
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'buy_vip',
        amount: String(-selectedVip.price),
        note: `${selectedVip.name} Purchase`,
        status: 'completed',
        createdAt: timeStr,
        payload: { vipLevel, books: selectedVip.books, perBook: selectedVip.perBook }
      }))
    }

    pipeline.hset(userKey, {
      vip: String(vipLevel),
      vipPricePaid: String(selectedVip.price),
      availableBalance: String(newBalance),
      hasBoughtVip: 'true',
      vipExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      unlockedBooks: JSON.stringify(unlockedBooks),
      completedBooks: '[]',
      books_read_today: '0',
      dailyIncome: '0',
      lastResetDate: dateStr,
      vip_bought_date: dateStr
    })

    await pipeline.exec()

    // Enforces payout strictly on the first VIP purchase
    if (isFirstTimePurchase) {
      await processHierarchicalCommissions(phone, vipLevel)
    }

    const updatedUser = await redis.hgetall(userKey) || {}
    updatedUser.unlockedBooks = safeParse(updatedUser.unlockedBooks)
    updatedUser.availableBalance = Number(updatedUser.availableBalance || 0)
    updatedUser.vip = Number(updatedUser.vip || 0)
    if (updatedUser.balance) delete updatedUser.balance;

    return NextResponse.json({ success: true, user: updatedUser, books: assignedBooksMeta }, { status: 200 })
  } catch (err) {
    console.error('POST /api/viplevels error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 }) 
  }
}

/**
 * FIXED 3-TIER ENGINE
 * Writes directly to full year key tx:phone:2026-mm-dd using "Invitation Rewards" header text
 */
async function processHierarchicalCommissions(buyerPhone, buyerVipLevel) {
  try {
    const vipAmounts = {
      1: 80000, 2: 250000, 3: 790000, 4: 1000000, 5: 1500000,
      6: 2100000, 7: 4000000, 8: 4600000, 9: 5000000, 10: 8000000
    }
    const today = getUgandaDateString() // e.g. 2026-07-02
    const timeStr = getUgandaDateTimeString()

    // TIER A UPLINE
    const uplineAPhone = await redis.hget(`user:${buyerPhone}`, 'invited_by')
    if (!uplineAPhone) return

    const uplineAVip = Number(await redis.hget(`user:${uplineAPhone}`, 'vip') || 0)
    if (uplineAVip > 0) {
      const baseTier = Math.min(uplineAVip, buyerVipLevel)
      const baseCost = vipAmounts[baseTier] || 0
      const rewardA = Math.floor(baseCost * 0.05)
      
      if (rewardA > 0) {
        await redis.lpush(`tx:${uplineAPhone}:${today}`, JSON.stringify({
          id: `tx_${Date.now()}_A_${Math.random().toString(36).slice(2)}`,
          type: 'commission', 
          amount: String(rewardA),
          note: `Invitation Rewards (Team A: ${buyerPhone})`,
          status: 'completed',
          createdAt: timeStr
        }))
        await redis.hincrbyfloat(`user:${uplineAPhone}`, 'availableBalance', rewardA)
      }
    }

    // TIER B UPLINE
    const uplineBPhone = await redis.hget(`user:${uplineAPhone}`, 'invited_by')
    if (!uplineBPhone) return

    const uplineBVip = Number(await redis.hget(`user:${uplineBPhone}`, 'vip') || 0)
    if (uplineBVip > 0) {
      const baseTier = Math.min(uplineBVip, buyerVipLevel)
      const baseCost = vipAmounts[baseTier] || 0
      const rewardB = Math.floor(baseCost * 0.02)
      
      if (rewardB > 0) {
        await redis.lpush(`tx:${uplineBPhone}:${today}`, JSON.stringify({
          id: `tx_${Date.now()}_B_${Math.random().toString(36).slice(2)}`,
          type: 'commission',
          amount: String(rewardB),
          note: `Invitation Rewards (Team B: ${buyerPhone})`,
          status: 'completed',
          createdAt: timeStr
        }))
        await redis.hincrbyfloat(`user:${uplineBPhone}`, 'availableBalance', rewardB)
      }
    }

    // TIER C UPLINE
    const uplineCPhone = await redis.hget(`user:${uplineBPhone}`, 'invited_by')
    if (!uplineCPhone) return

    const uplineCVip = Number(await redis.hget(`user:${uplineCPhone}`, 'vip') || 0)
    if (uplineCVip > 0) {
      const baseTier = Math.min(uplineCVip, buyerVipLevel)
      const baseCost = vipAmounts[baseTier] || 0
      const rewardC = Math.floor(baseCost * 0.01)
      
      if (rewardC > 0) {
        await redis.lpush(`tx:${uplineCPhone}:${today}`, JSON.stringify({
          id: `tx_${Date.now()}_C_${Math.random().toString(36).slice(2)}`,
          type: 'commission',
          amount: String(rewardC),