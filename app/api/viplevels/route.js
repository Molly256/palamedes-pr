export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'

const redis = Redis.fromEnv()

export const VIPS = {
 1: { books: 4, perBook: 625, price: 80000 },
 2: { books: 4, perBook: 2000, price: 250000 },
 3: { books: 4, perBook: 6500, price: 790000 },
 4: { books: 5, perBook: 7000, price: 1000000 },
 5: { books: 5, perBook: 10000, price: 1500000 },
 6: { books: 5, perBook: 14000, price: 2100000 },
 7: { books: 5, perBook: 28000, price: 4000000 },
 8: { books: 5, perBook: 32000, price: 4600000 },
 9: { books: 5, perBook: 40000, price: 5000000 },
 10: { books: 5, perBook: 60000, price: 8000000 },
}

function shuffle(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

function isWeekdayInUganda() {
  const ugandaDay = new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' })
  const d = new Date(ugandaDay).getDay() // 0=Sun, 1=Mon...6=Sat
  return d >= 1 && d <= 5
}

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' }) // YYYY-MM-DD
}

function setBalance(amount) {
  return { availableBalance: amount, balance: amount }
}

function safeParse(str, fallback = []) {
  try {
    return JSON.parse(str || '[]')
  } catch {
    return fallback
  }
}

// GET: /api/viplevels
export async function GET() {
  try {
    const levels = Object.keys(VIPS).map(k => ({
      level: Number(k),
    ...VIPS[k]
    }))
    return NextResponse.json({ success: true, levels })
  } catch (err) {
    console.error('GET /api/viplevels error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}

// POST: /api/viplevels - buy/upgrade VIP
export async function POST(req) {
  try {
    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid JSON' }, { status: 400 })
    }

    const { phone, vipLevel } = body
    if (!phone ||!vipLevel) {
      return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })
    }

    const userKey = `user:${phone}`
    const user = await redis.hgetall(userKey)
    if (!user ||!user.phone) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const selectedVip = VIPS[vipLevel]
    if (!selectedVip) {
      return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })
    }

    const currentVip = Number(user.vip || 0)
    if (vipLevel <= currentVip) {
      return NextResponse.json({ success: false, message: 'You already have this VIP or higher' }, { status: 400 })
    }

    const currentPricePaid = Number(user.vipPricePaid || 0)
    const upgradeCost = selectedVip.price - currentPricePaid
    const currentBalance = Number(user.availableBalance || user.balance || 0)

    if (currentBalance < upgradeCost) {
      return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 })
    }

    const today = getUgandaDateString()
    const alreadyBoughtToday = user.vip_bought_date === today
    const isWeekday = isWeekdayInUganda()
    const shouldCreateBooks = isWeekday &&!alreadyBoughtToday

    const newBalance = currentBalance - upgradeCost
    let unlockedBooks = safeParse(user.unlockedBooks)
    let assignedBooksMeta = [] // return to frontend so Books tab can render instantly

    const pipeline = redis.pipeline()

    if (shouldCreateBooks) {
      const booksPath = path.join(process.cwd(), 'public/data/books.json')
      const coversDir = path.join(process.cwd(), 'public/books/covers')

      const [allBooks, coverFiles] = await Promise.all([
        fs.readFile(booksPath, 'utf8').then(JSON.parse),
        fs.readdir(coversDir)
      ])

      // 1. Get valid IDs from covers: 11.jpg -> "11"
      const coverIds = new Set(
        coverFiles
         .map(f => f.replace(/\.jpg$/i, ''))
         .filter(id => /^\d+$/.test(id))
         .map(id => String(id))
      )

      // 2. Only use books.json entries that have a matching cover file
      const validBooks = allBooks.filter(b => coverIds.has(String(b.id)))

      if (validBooks.length === 0) {
        return NextResponse.json({ success: false, message: 'No books with covers found' }, { status: 500 })
      }

      const shuffled = shuffle(validBooks)
      const booksToAssign = shuffled.slice(0, Math.min(selectedVip.books, validBooks.length))

      unlockedBooks = booksToAssign.map(b => String(b.id))
      assignedBooksMeta = booksToAssign.map(b => ({
        id: String(b.id),
        title: b.title,
        cover: `/books/covers/${b.id}.jpg`,
        reward: selectedVip.perBook
      }))

      booksToAssign.forEach(b => {
        const bookId = String(b.id)
        const bookKey = `book:${phone}:${today}:${bookId}`
        pipeline.hset(bookKey, {
          phone,
          bookId,
          vipLevel: String(vipLevel),
          reward: selectedVip.perBook,
          title: b.title,
          cover: `/books/covers/${bookId}.jpg`,
          status: 'pending',
          date: today,
          createdAt: Date.now()
        })
        pipeline.sadd(`books:${phone}:${today}`, bookId)
      })
    }

    pipeline.hset(userKey, {
      vip: vipLevel,
      vipPricePaid: selectedVip.price,
    ...setBalance(newBalance),
      hasBoughtVip: 'true',
      vipExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      unlockedBooks: JSON.stringify(unlockedBooks),
      completedBooks: '[]',
      books_read_today: 0,
      dailyIncome: 0,
      lastResetDate: today,
      vip_bought_date: today // blocks 2nd buy same day
    })

    await pipeline.exec()
    await payInvitationReward(phone, vipLevel)

    const updatedUser = await redis.hgetall(userKey)
    updatedUser.unlockedBooks = safeParse(updatedUser.unlockedBooks)
    updatedUser.completedBooks = safeParse(updatedUser.completedBooks)
    updatedUser.availableBalance = Number(updatedUser.availableBalance || 0)
    updatedUser.balance = Number(updatedUser.balance || 0)
    updatedUser.vip = Number(updatedUser.vip || 0)
    updatedUser.books_read_today = Number(updatedUser.books_read_today || 0)
    updatedUser.dailyIncome = Number(updatedUser.dailyIncome || 0)
    updatedUser.vipPricePaid = Number(updatedUser.vipPricePaid || 0)

    const message = shouldCreateBooks
    ? `Upgraded to VIP ${vipLevel} successfully. ${assignedBooksMeta.length} books assigned.`
      : `Upgraded to VIP ${vipLevel} successfully. Books will be assigned on the next weekday.`

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message,
      books: assignedBooksMeta // [ {id, title, cover, reward} ] -> Books tab can use this
    })

  } catch (err) {
    console.error('POST /api/viplevels error:', err)
    return NextResponse.json({
      success: false,
      message: 'Server error',
      detail: process.env.NODE_ENV === 'development'? err.message : undefined
    }, { status: 500 })
  }
}

async function payInvitationReward(downlinePhone, vipLevelBought) {
  try {
    const inviterPhone = await redis.hget(`user:${downlinePhone}`, 'invited_by')
    if (!inviterPhone) return

    const inviterVip = Number(await redis.hget(`user:${inviterPhone}`, 'vip') || 0)
    const downlineVip = Number(vipLevelBought)
    if (inviterVip < downlineVip || inviterVip === 0) return

    const vipAmounts = {
      1: 80000, 2: 250000, 3: 790000, 4: 1000000, 5: 1500000,
      6: 2100000, 7: 4000000, 8: 4600000, 9: 5000000, 10: 8000000
    }
    const inviterAmount = vipAmounts[inviterVip]
    if (!inviterAmount) return

    const level = Number(await redis.hget(`downlines:${inviterPhone}`, downlinePhone))
    if (!level || level > 3) return

    const rate = level === 1? 0.05 : level === 2? 0.02 : 0.01
    const rewardAmount = Math.floor(inviterAmount * rate)
    if (rewardAmount <= 0) return

    await redis.lpush(`tx:${inviterPhone}`, JSON.stringify({
      id: Date.now(),
      type: 'invitation_reward',
      amount: rewardAmount,
      from: downlinePhone,
      level,
      vipLevel: vipLevelBought,
      date: new Date().toISOString(),
      status: 'completed'
    }))

    const inviterKey = `user:${inviterPhone}`
    const inviter = await redis.hgetall(inviterKey)
    const newBal = Number(inviter.availableBalance || inviter.balance || 0) + rewardAmount
    await redis.hset(inviterKey, setBalance(newBal))

  } catch (err) {
    console.error('Invitation reward error:', err)
  }
}