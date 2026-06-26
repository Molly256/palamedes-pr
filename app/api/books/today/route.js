export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    const date = searchParams.get('date') || getUgandaDateString()

    if (!phone) {
      return NextResponse.json({ success: false, message: 'Missing phone' }, { status: 400 })
    }

    const userKey = `user:${phone}`
    const user = await redis.hgetall(userKey)
    if (!user ||!user.phone) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    // 1. READ ONLY: Get today's book IDs from Redis Set. Nothing else.
    const bookIds = await redis.smembers(`books:${phone}:${date}`)
    
    if (!bookIds || bookIds.length === 0) {
      return NextResponse.json({ 
        success: true, 
        user: {
          vip: Number(user.vip || 0),
          availableBalance: Number(user.availableBalance || 0),
          balance: Number(user.balance || 0),
          books_read_today: Number(user.books_read_today || 0),
          dailyIncome: Number(user.dailyIncome || 0),
        },
        books: [] 
      })
    }

    // 2. READ ONLY: HGETALL each book key for this exact date
    const bookKeys = bookIds.map(id => `book:${phone}:${date}:${id}`)
    const booksData = await Promise.all(bookKeys.map(k => redis.hgetall(k)))
    
    // 3. Return raw Redis data. No joins, no fs, no covers check.
    const books = booksData
      .filter(b => b && b.bookId) // drop missing keys
      .map(b => ({
        bookId: String(b.bookId),
        status: b.status || 'pending',
        reward: Number(b.reward || 0),
        date: b.date || date, // <- needed for 24hr filter in frontend
        submittedAt: b.submittedAt || null,
        title: b.title || null,  // if you saved it in viplevels
        cover: b.cover || null   // if you saved it in viplevels
      }))

    return NextResponse.json({ 
      success: true, 
      user: {
        vip: Number(user.vip || 0),
        availableBalance: Number(user.availableBalance || 0),
        balance: Number(user.balance || 0),
        books_read_today: Number(user.books_read_today || 0),
        dailyIncome: Number(user.dailyIncome || 0),
      },
      books 
    })

  } catch (err) {
    console.error('GET /api/books/today error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}