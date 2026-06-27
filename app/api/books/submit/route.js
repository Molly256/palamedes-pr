import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { VIPS } from '@/app/api/viplevels/route'

const redis = Redis.fromEnv()
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
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
    const bookIdStr = String(bookId)
    const lockKey = `lock:submit:${phone}:${today}:${bookIdStr}` // <- Only 1 request per book per day

    if (action === 'read') {
      await redis.hset(bookKey, { bookId: bookIdStr, status: 'read', readAt: Date.now() })
      return NextResponse.json({ success: true, status: 'read' })
    }

    if (action === 'submit') {
      // STEP 1: LOCK FIRST. If 2 requests come at once, only 1 gets past this line.
      const locked = await redis.set(lockKey, '1', { nx: true, ex: 30 })
      if (!locked) {
        return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 409 })
      }

      try {
        // STEP 2: Everything after this is safe from race conditions
        const user = await redis.hgetall(userKey)
        if (!user?.phone) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

        const bookData = await redis.hgetall(bookKey)
        if (!bookData?.bookId) return NextResponse.json({ success: false, message: 'Book not found. Refresh.' }, { status: 400 })
        if (bookData.status === 'submitted') return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })
        if (bookData.status!== 'read') return NextResponse.json({ success: false, message: 'Click Read first' }, { status: 400 })

        const vip = Number(user.vip || 0)
        const vipConfig = VIPS[vip]
        if (!vipConfig) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

        if (user.lastResetDate!== today) {
          await redis.hset(userKey, { books_read_today: 0, dailyIncome: 0, lastResetDate: today })
        }

        const booksReadToday = Number(user.books_read_today || 0)
        if (booksReadToday >= vipConfig.books) {
          return NextResponse.json({ success: false, message: `TODAY'S BOOKS ARE DONE` }, { status: 400 })
        }

        const earned = vipConfig.perBook
        const tx = {
          id: `${phone}:${today}:${bookIdStr}:${Date.now()}`,
          type: 'book_submission',
          bookId: bookIdStr,
          amount: String(earned),
          createdAt: String(Date.now()),
          status: 'success',
          phone
        }

        // STEP 3: Atomic payout
        const pipeline = redis.pipeline()
        pipeline.hset(bookKey, { status: 'submitted', submittedAt: Date.now() })
        pipeline.hincrby(userKey, 'availableBalance', earned)
        pipeline.hincrby(userKey, 'dailyIncome', earned)
        pipeline.hincrby(userKey, 'books_read_today', 1)
        pipeline.lpush(txKey, JSON.stringify(tx))
        await pipeline.exec()

        const updatedUser = await redis.hgetall(userKey)

        return NextResponse.json({
          success: true,
          user: {
          ...updatedUser,
            completedBooks: [],
            availableBalance: Number(updatedUser.availableBalance || 0),
            dailyIncome: Number(updatedUser.dailyIncome || 0),
            books_read_today: Number(updatedUser.books_read_today || 0),
          },
          earned,
          status: 'submitted',
          message: `+${earned} UGX`
        })

      } catch (err) {
        // If payout fails, release lock so user can retry
        await redis.del(lockKey)
        throw err
      }
    }
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Submit error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}