export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { VIPS } from '@/app/config/vips' // <- import from config

const redis = Redis.fromEnv()

function shuffle(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

function setBalance(amount) {
  return { availableBalance: String(amount), balance: String(amount) }
}

function safeParse(str, fallback = []) {
  try { return JSON.parse(str || '[]') } catch { return fallback }
}

async function assignBooksToUser(phone, vipLevel, today, pipeline) {
  const selectedVip = VIPS[vipLevel]
  const booksPath = path.join(process.cwd(), 'app/data/books.json') // FIXED: was public/data
  const coversDir = path.join(process.cwd(), 'public/books/covers') // Covers still from public/

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
    const { phone, vipLevel, backfill } = await req.json()
    if (!phone ||!vipLevel) return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })

    const userKey = `user:${phone}`
    const user = await redis.hgetall(userKey)
    if (!user?.phone) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const selectedVip = VIPS[vipLevel]
    if (!selectedVip) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

    const currentVip = Number(user.vip || 0)
    const currentBooks = safeParse(user.unlockedBooks)
    const today = getUgandaDateString()

    if (backfill === true && currentVip >= vipLevel && currentBooks.length === 0) {
      const pipeline = redis.pipeline()
      const { unlockedBooks, assignedBooksMeta } = await assignBooksToUser(phone, currentVip, today, pipeline)
      pipeline.hset(userKey, { unlockedBooks: JSON.stringify(unlockedBooks), vip_bought_date: today, lastResetDate: today })
      await pipeline.exec()
      const updatedUser = await redis.hgetall(userKey)
      updatedUser.unlockedBooks = safeParse(updatedUser.unlockedBooks)
      return NextResponse.json({ success: true, user: updatedUser, message: `Backfilled: ${assignedBooksMeta.length} books`, books: assignedBooksMeta })
    }

    if (vipLevel <= currentVip) return NextResponse.json({ success: false, message: 'You already have this VIP or higher' }, { status: 400 })

    const currentPricePaid = Number(user.vipPricePaid || 0)
    const upgradeCost = selectedVip.price - currentPricePaid
    const currentBalance = Number(user.availableBalance || user.balance || 0)
    if (currentBalance < upgradeCost) return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 })

    const newBalance = currentBalance - upgradeCost
    const pipeline = redis.pipeline()
    const { unlockedBooks, assignedBooksMeta } = await assignBooksToUser(phone, vipLevel, today, pipeline)

    pipeline.hset(userKey, {
      vip: String(vipLevel), vipPricePaid: String(selectedVip.price),
    ...setBalance(newBalance), hasBoughtVip: 'true',
      vipExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      unlockedBooks: JSON.stringify(unlockedBooks), completedBooks: '[]',
      books_read_today: '0', dailyIncome: '0', lastResetDate: today, vip_bought_date: today
    })
    await pipeline.exec()
    await payInvitationReward(phone, vipLevel)

    const updatedUser = await redis.hgetall(userKey)
    updatedUser.unlockedBooks = safeParse(updatedUser.unlockedBooks)
    updatedUser.availableBalance = Number(updatedUser.availableBalance || 0)
    updatedUser.vip = Number(updatedUser.vip || 0)

    return NextResponse.json({ success: true, user: updatedUser, message: `Upgraded to VIP ${vipLevel}. ${assignedBooksMeta.length} books`, books: assignedBooksMeta })
  } catch (err) {
    console.error('POST /api/viplevels error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}

async function payInvitationReward(downlinePhone, vipLevelBought) {
  try {
    const inviterPhone = await redis.hget(`user:${downlinePhone}`, 'invited_by')
    if (!inviterPhone) return
    const inviterVip = Number(await redis.hget(`user:${inviterPhone}`, 'vip') || 0)
    if (inviterVip < vipLevelBought || inviterVip === 0) return
    const vipAmounts = { 1: 80000, 2: 250000, 3: 790000, 4: 1000000, 5: 1500000, 6: 2100000, 7: 4000000, 8: 4600000, 9: 5000000, 10: 8000000 }
    const inviterAmount = vipAmounts[inviterVip]
    if (!inviterAmount) return
    const level = Number(await redis.hget(`downlines:${inviterPhone}`, downlinePhone))
    if (!level || level > 3) return
    const rate = level === 1? 0.05 : level === 2? 0.02 : 0.01
    const rewardAmount = Math.floor(inviterAmount * rate)
    if (rewardAmount <= 0) return
    await redis.lpush(`tx:${inviterPhone}`, JSON.stringify({
      id: String(Date.now()), type: 'invitation_reward', amount: rewardAmount,
      from: downlinePhone, level, vipLevel: vipLevelBought,
      date: new Date().toISOString(), status: 'completed'
    }))
    const inviterKey = `user:${inviterPhone}`
    const inviter = await redis.hgetall(inviterKey)
    const newBal = Number(inviter.availableBalance || inviter.balance || 0) + rewardAmount
    await redis.hset(inviterKey, setBalance(newBal))
  } catch (err) { console.error('Invitation reward error:', err) }
}