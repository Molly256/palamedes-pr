import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

const VIPS = {
 1: { perBook: 625, books: 4 },
 2: { perBook: 2000, books: 4 },
 3: { perBook: 6500, books: 4 },
 4: { perBook: 7000, books: 5 },
 5: { perBook: 10000, books: 5 },
 6: { perBook: 14000, books: 5 },
 7: { perBook: 28000, books: 5 },
 8: { perBook: 32000, books: 5 },
 9: { perBook: 40000, books: 5 },
 10: { perBook: 60000, books: 5 },
}

function isWeekdayInUganda() {
  const ugandaDate = new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' })
  const day = new Date(ugandaDate).getDay()
  return day >= 1 && day <= 5
}

export async function POST(req) {
  try {
    const { phone, bookId } = await req.json()
    if (!phone ||!bookId) return Response.json({ success: false, message: 'Missing data' }, { status: 400 })

    if (!isWeekdayInUganda()) {
      return Response.json({ success: false, message: 'Submissions are only allowed Monday to Friday.' })
    }

    const userKey = `user:${phone}`
    const txKey = `tx:${phone}`
    const user = await redis.hgetall(userKey)
    if (!user ||!user.phone) return Response.json({ success: false, message: 'User not found' }, { status: 404 })

    const vip = Number(user.vip || 0)
    if (vip === 0) return Response.json({ success: false, message: 'No active VIP' })

    const vipConfig = VIPS[vip]
    if (!vipConfig) return Response.json({ success: false, message: 'Invalid VIP level' })

    const booksReadToday = Number(user.books_read_today || 0)
    if (booksReadToday >= vipConfig.books) {
      return Response.json({ success: false, message: `Daily limit reached. You can submit ${vipConfig.books} books per day.` })
    }

    const unlocked = JSON.parse(user.unlockedBooks || '[]')
    if (!unlocked.includes(bookId)) return Response.json({ success: false, message: 'Book not unlocked' })

    const completed = JSON.parse(user.completedBooks || '[]')
    if (completed.includes(bookId)) return Response.json({ success: false, message: 'Already submitted' })

    const earned = vipConfig.perBook
    const newAvailableBalance = Number(user.availableBalance || 0) + earned
    const newDailyIncome = Number(user.dailyIncome || 0) + earned
    const newCompleted = [...completed, bookId]

    const tx = {
      id: Date.now(),
      type: 'book_submission',
      bookId,
      amount: earned,
      date: new Date().toISOString(),
      status: 'completed'
    }

    const pipeline = redis.pipeline()
    pipeline.hset(userKey, {
      availableBalance: newAvailableBalance,
      dailyIncome: newDailyIncome,
      completedBooks: JSON.stringify(newCompleted),
      books_read_today: booksReadToday + 1
    })
    pipeline.lpush(txKey, JSON.stringify(tx))
    await pipeline.exec()

    const updatedUser = await redis.hgetall(userKey)
    updatedUser.unlockedBooks = JSON.parse(updatedUser.unlockedBooks || '[]')
    updatedUser.completedBooks = JSON.parse(updatedUser.completedBooks || '[]')
    updatedUser.availableBalance = Number(updatedUser.availableBalance)
    updatedUser.dailyIncome = Number(updatedUser.dailyIncome || 0)
    updatedUser.vip = Number(updatedUser.vip)
    updatedUser.books_read_today = Number(updatedUser.books_read_today)

    return Response.json({ success: true, user: updatedUser, earned })
  } catch (err) {
    console.error(err)
    return Response.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}