import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import { VIPS } from '../../viplevels/route' // ← changed from../ to../../

const redis = Redis.fromEnv()

function isWeekdayInUganda() {
  const ugandaDate = new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' })
  const day = new Date(ugandaDate).getDay()
  return day >= 1 && day <= 5
}

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

function setBalance(amount) {
  return { availableBalance: amount, balance: amount }
}

export async function POST(req) {
  try {
    const { phone, bookId } = await req.json()
    if (!phone ||!bookId) {
      return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })
    }

    if (!isWeekdayInUganda()) {
      return NextResponse.json({ success: false, message: 'Submissions are only allowed Monday to Friday.' }, { status: 400 })
    }

    const userKey = `user:${phone}`
    const txKey = `tx:${phone}`
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

    const booksReadToday = Number(user.books_read_today || 0)
    if (booksReadToday >= vipConfig.books) {
      return NextResponse.json({ success: false, message: `Daily limit reached. You can submit ${vipConfig.books} books per day.` }, { status: 400 })
    }

    const unlocked = JSON.parse(user.unlockedBooks || '[]').map(String)
    const completed = JSON.parse(user.completedBooks || '[]').map(String)
    const bookIdStr = String(bookId)

    if (!unlocked.includes(bookIdStr)) {
      return NextResponse.json({ success: false, message: 'Book not unlocked' }, { status: 400 })
    }

    if (completed.includes(bookIdStr)) {
      return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })
    }

    const today = getUgandaDateString()
    const bookKey = `book:${phone}:${today}:${bookIdStr}`
    const bookData = await redis.hgetall(bookKey)
    if (!bookData ||!bookData.bookId) {
      return NextResponse.json({ success: false, message: 'Book not found' }, { status: 404 })
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
    updatedUser.unlockedBooks = JSON.parse(updatedUser.unlockedBooks || '[]')
    updatedUser.completedBooks = JSON.parse(updatedUser.completedBooks || '[]')
    updatedUser.availableBalance = Number(updatedUser.availableBalance || 0)
    updatedUser.balance = Number(updatedUser.balance || 0)
    updatedUser.dailyIncome = Number(updatedUser.dailyIncome || 0)
    updatedUser.vip = Number(user.vip || 0)
    updatedUser.books_read_today = Number(user.books_read_today || 0)

    return NextResponse.json({
      success: true,
      user: updatedUser,
      earned,
      message: `+${earned} UGX added to your balance`
    })

  } catch (err) {
    console.error('Submit error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}