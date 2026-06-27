import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { VIPS } from '@/app/api/viplevels/route'

const redis = Redis.fromEnv()
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

function safeParse(str, fallback = []) {
  try {
    return JSON.parse(str || '[]')
  } catch {
    return fallback
  }
}

export async function POST(req) {
  try {
    const { phone, bookId, action } = await req.json()
    if (!phone || !bookId || !action) {
      return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })
    }

    const today = getUgandaDateString()
    const bookKey = `book:${phone}:${today}:${bookId}`
    const userKey = `user:${phone}`
    const txKey = `tx:${phone}`
    const lockKey = `lock:submit:${phone}:${today}` // <- prevents double submit race
    const bookIdStr = String(bookId)

    if (action === 'read') {
      await redis.hset(bookKey, { bookId: bookIdStr, status: 'read', readAt: Date.now() })
      return NextResponse.json({ success: true, status: 'read' })
    }

    if (action === 'submit') {
      // 1. Set a 3s lock so user can't spam Submit on 2 books at once
      const lock = await redis.set(lockKey, '1', { ex: 3, nx: true })
      if (!lock) {
        return NextResponse.json({ success: false, message: 'Wait 1s, processing...' }, { status: 429 })
      }

      try {
        // 2. Always get fresh user + book data inside the lock
        const [user, bookData] = await redis.mget(userKey, bookKey)
        if (!user || !user.phone) {
          return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
        }
        if (!bookData) {
          return NextResponse.json({ success: false, message: 'Book not found. Refresh page.' }, { status: 400 })
        }
        if (bookData.status !== 'read') {
          return NextResponse.json({ success: false, message: 'Click Read first' }, { status: 400 })
        }

        const vip = Number(user.vip || 0)
        if (vip === 0) return NextResponse.json({ success: false, message: 'No active VIP' }, { status: 400 })
        const vipConfig = VIPS[vip]
        if (!vipConfig) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

        // 3. Reset if new day
        if (user.lastResetDate !== today) {
          await redis.hset(userKey, {
            books_read_today: 0,
            dailyIncome: 0,
            completedBooks: '[]',
            lastResetDate: today
          })
          user.books_read_today = 0
          user.completedBooks = '[]'
          user.dailyIncome = 0
        }

        const booksReadToday = Number(user.books_read_today || 0)
        if (booksReadToday >= vipConfig.books) {
          return NextResponse.json({ success: false, message: `TODAY'S BOOKS ARE DONE` }, { status: 400 })
        }

        const completed = safeParse(user.completedBooks).map(String)
        if (completed.includes(bookIdStr)) {
          return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })
        }

        const earned = vipConfig.perBook
        const newCompleted = [...completed, bookIdStr]

        const tx = {
          id: Date.now(),
          type: 'book_submission',
          bookId: bookIdStr,
          amount: earned,
          date: new Date().toISOString(),
          status: 'completed'
        }

        // 4. Atomic: Use HINCRBY so Redis handles +1, not us. No race.
        const pipeline = redis.pipeline()
        pipeline.hset(bookKey, { status: 'submitted', submittedAt: Date.now() })
        pipeline.hincrby(userKey, 'availableBalance', earned)
        pipeline.hincrby(userKey, 'dailyIncome', earned)
        pipeline.hincrby(userKey, 'books_read_today', 1)
        pipeline.hset(userKey, { completedBooks: JSON.stringify(newCompleted) })
        pipeline.lpush(txKey, JSON.stringify(tx))
        await pipeline.exec()

        // 5. Read back fresh once after write
        const updatedUser = await redis.hgetall(userKey)
        updatedUser.completedBooks = safeParse(updatedUser.completedBooks)
        updatedUser.availableBalance = Number(updatedUser.availableBalance || 0)
        updatedUser.dailyIncome = Number(updatedUser.dailyIncome || 0)
        updatedUser.books_read_today = Number(updatedUser.books_read_today || 0)

        return NextResponse.json({
          success: true,
          user: updatedUser,
          earned,
          status: 'submitted',
          message: `+${earned} UGX`
        })
      } finally {
        await redis.del(lockKey) // always release lock
      }
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error('Submit error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}