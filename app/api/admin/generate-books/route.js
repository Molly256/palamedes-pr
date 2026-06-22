import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const redis = Redis.fromEnv()

function isWeekdayInUganda() {
  const ugandaDate = new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' })
  const day = new Date(ugandaDate).getDay() // 1=Mon ... 5=Fri
  return day >= 1 && day <= 5
}

function getTodayUgandaDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export async function GET() {
  if (!isWeekdayInUganda()) {
    return NextResponse.json({ 
      success: false, 
      message: 'Can only run Mon-Fri Uganda time' 
    })
  }

  const today = getTodayUgandaDate()
  const runKey = `books_generated:${today}`

  if (await redis.get(runKey)) {
    return NextResponse.json({ 
      success: false, 
      message: `Already generated for ${today}` 
    })
  }

  try {
    // 1. Load all books from public/data/books.json
    const booksPath = path.join(process.cwd(), 'public/data/books.json')
    const allBooks = JSON.parse(fs.readFileSync(booksPath, 'utf-8'))

    if (allBooks.length < 4) {
      return NextResponse.json({ 
        success: false, 
        message: 'Need at least 4 books in books.json' 
      })
    }

    // 2. Pick 4 random IDs
    const shuffledIds = allBooks
      .map(b => b.id.toString()) // make sure it's string to match your frontend
      .sort(() => 0.5 - Math.random())
      .slice(0, 4)

    // 3. Assign to all VIP 1-3 users
    const userKeys = await redis.keys('user:*')
    let assigned = 0

    for (const key of userKeys) {
      const user = await redis.hgetall(key)
      const vip = Number(user.vip || 0)

      if (vip >= 1 && vip <= 3) {
        await redis.hset(key, {
          unlockedBooks: JSON.stringify(shuffledIds), // only 4 IDs
          completedBooks: JSON.stringify([]),         // reset daily
          books_read_today: 0,
          lastBooksDate: today
        })
        assigned++
      }
    }

    await redis.set(runKey, '1', { ex: 86400 }) // block re-run for 24h

    return NextResponse.json({
      success: true,
      message: `Assigned 4 books to ${assigned} VIP 1-3 users`,
      bookIds: shuffledIds
    })

  } catch (err) {
    console.error(err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}