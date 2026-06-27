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
    const lockKey = `lock:submit:${phone}`
    const completedSetKey = `completed:${phone}:${today}`
    const bookIdStr = String(bookId)

    if (action === 'read') {
      await redis.hset(bookKey, { bookId: bookIdStr, status: 'read', readAt: Date.now() })
      return NextResponse.json({ success: true, status: 'read' })
    }

    if (action === 'submit') {
      // 1. Soft lock 2s to stop UI spam clicks
      const locked = await redis.set(lockKey, Date.now(), { ex: 2, nx: true })
      if (!locked) {
        return NextResponse.json({ success: false, message: 'Processing, try again in 1s' }, { status: 429 })
      }

      try {
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

        // 2. Daily reset
        if (user.lastResetDate!== today) {
          await redis.hset(userKey, {
            books_read_today: 0,
            dailyIncome: 0,
            lastResetDate: today
          })
        }

        // 3. KEY FIX: Atomic check + add. If 2 requests race, only 1 gets `added=1`
        const added = await redis.sadd(completedSetKey, bookIdStr)
        if (added === 0) {
          return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })
        }

        // 4. Check daily limit AFTER SADD so we can rollback if over limit
        const booksReadToday = Number(user.books_read_today || 0)
        if (booksReadToday >= vipConfig.books) {
          await redis.srem(completedSetKey, bookIdStr) // rollback the SADD
          return NextResponse.json({ success: false, message: `TODAY'S BOOKS ARE DONE` }, { status: 400 })
        }

        // 5. Pay according to VIP level + create tx history
        const earned = vipConfig.perBook
        const tx = {
          id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type: 'book_submission',
          bookId: bookIdStr,
          amount: String(earned),
          createdAt: String(Date.now()),
          status: 'success',
          phone
        }

        // 6. ATOMIC: Update book status, pay, increment, save tx
        const pipeline = redis.pipeline()
        pipeline.hset(bookKey, { status: 'submitted', submittedAt: Date.now() })
        pipeline.hincrby(userKey, 'availableBalance', earned)
        pipeline.hincrby(userKey, 'dailyIncome', earned)
        pipeline.hincrby(userKey, 'books_read_today', 1)
        pipeline.lpush(txKey, JSON.stringify(tx))
        await pipeline.exec()

        // 7. Return fresh state for BOOKS -> COMPLETED move
        const completedArr = await redis.smembers(completedSetKey)
        const updatedUser = await redis.hgetall(userKey)

        return NextResponse.json({
          success: true,
          user: {
          ...updatedUser,
            completedBooks: completedArr, // <- Send this to frontend. Use it to filter BOOKS vs COMPLETED
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