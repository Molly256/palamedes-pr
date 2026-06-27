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
    const { phone, bookId, action, idempotencyKey } = await req.json()
    if (!phone ||!bookId ||!action ||!idempotencyKey) { // <- FIX 2: Require it
      return NextResponse.json({ success: false, message: 'Missing data or idempotencyKey' }, { status: 400 })
    }

    const today = getUgandaDateString()
    const bookKey = `book:${phone}:${today}:${bookId}`
    const userKey = `user:${phone}`
    const txKey = `tx:${phone}`
    const completedSetKey = `completed:${phone}:${today}`
    const bookIdStr = String(bookId)
    const idemKey = `idem:${idempotencyKey}` // <- FIX 1: Closed backtick

    if (action === 'read') {
      await redis.hset(bookKey, { bookId: bookIdStr, status: 'read', readAt: Date.now() })
      return NextResponse.json({ success: true, status: 'read' })
    }

    if (action === 'submit') {
      // 1. IDEMPOTENCY GUARD: Only 1 request with this key can run
      const claimed = await redis.set(idemKey, '1', { nx: true, ex: 60 })
      if (!claimed) {
        return NextResponse.json({ success: false, message: 'Already processed' }, { status: 409 })
      }

      try {
        const user = await redis.hgetall(userKey)
        if (!user?.phone) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

        const bookData = await redis.hgetall(bookKey)
        if (!bookData?.bookId) return NextResponse.json({ success: false, message: 'Book not found. Refresh.' }, { status: 400 })
        if (bookData.status!== 'read') return NextResponse.json({ success: false, message: 'Click Read first' }, { status: 400 })

        const vip = Number(user.vip || 0)
        const vipConfig = VIPS[vip]
        if (!vipConfig) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

        if (user.lastResetDate!== today) {
          await redis.hset(userKey, { books_read_today: 0, dailyIncome: 0, lastResetDate: today })
        }

        const added = await redis.sadd(completedSetKey, bookIdStr)
        if (added === 0) return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })

        const booksReadToday = Number(user.books_read_today || 0)
        if (booksReadToday >= vipConfig.books) {
          await redis.srem(completedSetKey, bookIdStr)
          return NextResponse.json({ success: false, message: `TODAY'S BOOKS ARE DONE` }, { status: 400 })
        }

        const earned = vipConfig.perBook
        const tx = {
          id: idempotencyKey, // <- Use idemKey for tx id
          type: 'book_submission',
          bookId: bookIdStr,
          amount: String(earned),
          createdAt: String(Date.now()),
          status: 'success',
          phone
        }

        const pipeline = redis.pipeline()
        pipeline.hset(bookKey, { status: 'submitted', submittedAt: Date.now() })
        pipeline.hincrby(userKey, 'availableBalance', earned)
        pipeline.hincrby(userKey, 'dailyIncome', earned)
        pipeline.hincrby(userKey, 'books_read_today', 1)
        pipeline.lpush(txKey, JSON.stringify(tx))
        await pipeline.exec()

        const completedArr = await redis.smembers(completedSetKey)
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
      } catch (e) {
        await redis.del(idemKey)
        throw e
      }
    }
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Submit error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}