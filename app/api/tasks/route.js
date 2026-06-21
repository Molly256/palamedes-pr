import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
const redis = Redis.fromEnv()
const TZ = 'Africa/Kampala'

const VIP_CONFIG = {
 1: { books: 4, perBook: 625 },
 2: { books: 4, perBook: 2000 },
 3: { books: 4, perBook: 6500 },
 4: { books: 5, perBook: 7000 },
 5: { books: 5, perBook: 10000 },
 6: { books: 5, perBook: 14000 },
 7: { books: 5, perBook: 28000 },
 8: { books: 5, perBook: 32000 },
 9: { books: 5, perBook: 40000 },
 10: { books: 5, perBook: 60000 },
}

function getUGDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

async function getBooksData() {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000'

  const res = await fetch(`${baseUrl}/data/books.json`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`Failed to fetch books.json: ${res.status}`)
  }
  return res.json()
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    const today = getUGDateStr()

    // Get task IDs, user data + books in parallel
    const [taskIds, user, booksData] = await Promise.all([
      redis.smembers(`tasks:${phone}:${today}`),
      redis.hgetall(`user:${phone}`),
      getBooksData()
    ])

    if (!taskIds.length) {
      return NextResponse.json({ success: true, books: [], user: user || null, date: today })
    }

    // Get all task statuses
    const tasks = await Promise.all(
      taskIds.map(id => redis.hgetall(`task:${phone}:${today}:${id}`))
    )

    // Get user VIP level for reward amount
    const vip = Number(user?.vip) || Number(user?.vip_level) || 0
    const reward = VIP_CONFIG[vip]?.perBook || 0

    // Build lookup map with string keys
    const booksMap = booksData.reduce((acc, b) => {
      acc[String(b.id)] = b
      return acc
    }, {})

    // Merge book IDs with full book data
    const books = tasks.map((task) => {
      const bookId = task.bookId
      const status = task.status
      const book = booksMap[bookId]

      if (!book) {
        console.warn(`Book ID ${bookId} not found in books.json`)
        return {
          id: bookId,
          title: 'Book not found',
          author: '',
          cover: '/placeholder.png',
          preview: '',
          status,
          reward
        }
      }

      return {
        id: bookId,
        title: book.title,
        author: book.author,
        cover: book.cover,
        preview: book.preview,
        status,
        reward
      }
    })

    return NextResponse.json({
      success: true,
      books,
      user: user || null,
      date: today
    })

  } catch (err) {
    console.error('tasks error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}