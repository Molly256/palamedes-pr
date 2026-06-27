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
    const parsed = JSON.parse(str || '[]')
    return Array.isArray(parsed)? parsed : fallback
  } catch {
    return fallback
  }
}

export async function POST(req) {
  try {
    const { phone, bookId, action } = await req.json()
    if (!phone ||!bookId ||!action) {
      return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })
    }

    const today = getUgandaDateString()
    const bookKey = `book:${phone}:${today}:${bookId}`
    const userKey = `user:${phone}`
    const txKey = `tx:${phone}`
    const lockKey = `lock:submit:${phone}`
    const bookIdStr = String(bookId)

    if (action === 'read') {
      await redis.hset(bookKey, { bookId: bookIdStr, status: 'read', readAt: Date.now() })
      return NextResponse.json({ success: true, status: 'read' })
    }

    if (action === 'submit') {
      // 1. Redis SETNX lock for 2 seconds. Stops double-tap + race on book 2.
      const locked = await redis.set(lockKey, Date.now(), { ex: 2, nx: true })
      if (!locked) {
        return NextResponse.json({ success: false, message: 'Processing, try again in 1s' }, { status: 429 })
      }

      try {
        // 2. Get fresh data every time inside the lock
        const user = await redis.hgetall(userKey)
        if (!user?.phone) {
          return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
        }

        const bookData = await redis.hgetall(bookKey)
        if (!bookData?.bookId) {
          return NextResponse.json({ success: false, message: 'Book not found. Refresh.' }, { status: 400 })
        }
        if (bookData.status!== 'read') {
          return NextResponse.json({ success: false, message: 'Click Read first' }, { status: 400 })
        }

        const vip = Number(user.vip || 0)
        if (vip === 0) return NextResponse.json({ success: false, message: 'No active VIP' }, { status: 400 })
        const vipConfig = VIPS[vip]
        if (!vipConfig) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

        // 3. Reset day if needed - but only if we're inside the lock
        if (user.lastResetDate!== today) {
          await redis.hset(userKey, {
            books_read_today: 0,
            dailyIncome: 0,
            completedBooks: '[]',
            lastResetDate: today
          })
        }

        // 4. Re-read after reset to avoid stale data
        const freshUser = await redis.hgetall(userKey)
        const booksReadToday = Number(freshUser.books_read_today || 0)
        if (booksReadToday >= vipConfig.books) {
          return NextResponse.json({ success: false, message: `TODAY'S BOOKS ARE DONE` }, { status: 400 })
        }

        const completed = safeParse(freshUser.completedBooks)
        if (completed.includes(bookIdStr)) {
          return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })
        }

        const earned = vipConfig.perBook
        const tx = {
          id: Date.now(),
          type: 'book_submission',
          bookId: bookIdStr,
          amount: earned,
          date: new Date().toISOString(),
          status: 'completed'
        }

        // 5. ATOMIC: Use HINCRBY so Redis does math, not Node. No race.
        // Use SADD for completedBooks instead of JSON array to avoid corruption
        const pipeline = redis.pipeline()
        pipeline.hset(bookKey, { status: 'submitted', submittedAt: Date.now() })
        pipeline.hincrby(userKey, 'availableBalance', earned)
        pipeline.hincrby(userKey, 'dailyIncome', earned)
        pipeline.hincrby(userKey, 'books_read_today', 1)
        pipeline.sadd(`completed:${phone}:${today}`, bookIdStr) // <- Redis Set, no JSON corruption
        pipeline.lpush(txKey, JSON.stringify(tx))
        await pipeline.exec()

        // 6. Read final state
        const completedArr = await redis.smembers(`completed:${phone}:${today}`)
        const updatedUser = await redis.hgetall(userKey)

        return NextResponse.json({
          success: true,
          user: {
           ...updatedUser,
            completedBooks: completedArr,
            availableBalance: Number(updatedUser.availableBalance || 0),
            dailyIncome: Number(updatedUser.dailyIncome || 0),
            books_read_today: Number(updatedUser.books_read_today || 0),
          },
          earned,
          status: 'submitted',
          message: `+${earned} UGX`
        })
      } finally {
        await redis.del(lockKey) // always release
      }
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error('Submit error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}