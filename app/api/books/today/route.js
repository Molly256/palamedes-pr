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

    let bookKeys = await redis.smembers(`books:${phone}:${date}`)
    
    // Fallback to unlockedBooks if set is empty
    if (!bookKeys || bookKeys.length === 0) {
      const unlocked = JSON.parse(user.unlockedBooks || '[]')
      bookKeys = unlocked.map(id => `book:${phone}:${date}:${id}`)
    }
    
    if (!bookKeys || bookKeys.length === 0) {
      user.unlockedBooks = JSON.parse(user.unlockedBooks || '[]')
      user.completedBooks = JSON.parse(user.completedBooks || '[]')
      user.availableBalance = Number(user.availableBalance || 0)
      user.balance = Number(user.balance || 0)
      user.vip = Number(user.vip || 0)
      user.books_read_today = Number(user.books_read_today || 0)
      user.dailyIncome = Number(user.dailyIncome || 0)
      
      return NextResponse.json({ success: true, user, books: [] })
    }

    const booksData = await Promise.all(bookKeys.map(k => redis.hgetall(k)))
    
    const books = booksData
      .filter(b => b && b.bookId) // skip deleted keys
      .map(b => ({
        bookId: String(b.bookId),
        status: b.status || 'pending',
        reward: Number(b.reward || 0),
        submittedAt: b.submittedAt || null
      }))

    user.unlockedBooks = JSON.parse(user.unlockedBooks || '[]')
    user.completedBooks = JSON.parse(user.completedBooks || '[]')
    user.availableBalance = Number(user.availableBalance || 0)
    user.balance = Number(user.balance || 0)
    user.vip = Number(user.vip || 0)
    user.books_read_today = Number(user.books_read_today || 0)
    user.dailyIncome = Number(user.dailyIncome || 0)

    return NextResponse.json({ success: true, user, books })

  } catch (err) {
    console.error('GET /api/books/today error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}