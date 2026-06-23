export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import { VIPS } from '@/app/api/viplevels/route'

const redis = Redis.fromEnv()

function isWeekdayInUganda() {
  const ugandaDate = new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' })
  const day = new Date(ugandaDate).getDay()
  return day >= 1 && day <= 5
}

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

function setBalance(amount) {
  return { availableBalance: amount, balance: amount }
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

    // ACTION 1: Read
    if (action === 'read') {
      await redis.hset(bookKey, { bookId: bookIdStr, status: 'read', readAt: Date.now() })
      return NextResponse.json({ success: true, status: 'read', message: 'Marked as read' })
    }

    // ACTION 2: Submit
    if (action === 'submit') {
      if (!isWeekdayInUganda()) {
        return NextResponse.json({ success: false, message: 'Submissions are only allowed Monday to Friday.' }, { status: 400 })
      }

      const user = await redis.hgetall(userKey)
      if (!user ||!user.phone) {
        return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
      }

      const vip = Number(user.vip || 0)
      if (vip === 0) {
        return NextResponse.json({ success: false, message: 'No active VIP' }, { status: 400 })
      }

      const vipConfig = VIPS[vip]
      if (!vipConfig) {
        return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })
      }

      // Daily reset
      if (user.lastResetDate !== today) {
        await redis.hset(userKey, {
          books_read_today: 0,
          dailyIncome: 0,
          completedBooks: '[]',
          lastResetDate: today
        })
      }

      const booksReadToday = Number(user.books_read_today || 0)
      if (booksReadToday >= vipConfig.books) {
        return NextResponse.json({ success: false, message: `TODAY'S BOOKS ARE DONE` }, { status: 400 })
      }

      const completed = safeParse(user.completedBooks).map(String)

      if (completed.includes(bookIdStr)) {
        return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })
      }

      const bookData = await redis.hgetall(bookKey)
      if (!bookData) {
        return NextResponse.json({ success: false, message: 'Book not found. Refresh page.' }, { status: 400 })
      }
      if (bookData.status!== 'read') {
        return NextResponse.json({ success: false, message: 'Click Read first' }, { status: 400 })
      }

      const earned = vipConfig.perBook
      const currentBalance = Number(user.availableBalance || user.balance || 0)
      const newBalance = currentBalance + earned
      const newDailyIncome = Number(user.dailyIncome || 0) + earned
      const newCompleted = [...completed, bookIdStr]

      const tx = {
        id: Date.now(),
        type: 'book_submission',
        bookId: bookIdStr,
        amount: earned,
        date: new Date().toISOString(),
        status: 'completed'
      }

      const pipeline = redis.pipeline()
      pipeline.hset(bookKey, { status: 'completed', submittedAt: Date.now() })
      pipeline.hset(userKey, {
     ...setBalance(newBalance),
        dailyIncome: newDailyIncome,
        completedBooks: JSON.stringify(newCompleted),
        books_read_today: booksReadToday + 1
      })
      pipeline.lpush(txKey, JSON.stringify(tx))
      await pipeline.exec()

      const updatedUser = await redis.hgetall(userKey)
      updatedUser.completedBooks = safeParse(updatedUser.completedBooks)
      updatedUser.availableBalance = Number(updatedUser.availableBalance || 0)
      updatedUser.balance = Number(updatedUser.balance || 0)
      updatedUser.dailyIncome = Number(updatedUser.dailyIncome || 0)
      updatedUser.books_read_today = Number(user.books_read_today || 0)

      return NextResponse.json({
        success: true,
        user: updatedUser,
        earned,
        status: 'completed',
        message: `Book submitted successfully. +${earned} UGX added to daily income`
      })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error('Submit error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}