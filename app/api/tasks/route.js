import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

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
    const taskKey = `task:${phone}:${today}`
    const userKey = `user:${phone}`

    // Get task status hash and user data + books in parallel
    const [taskHash, user, booksData] = await Promise.all([
      kv.hgetall(taskKey),
      kv.hgetall(userKey),
      getBooksData()
    ])

    if (!taskHash || Object.keys(taskHash).length === 0) {
      return NextResponse.json({ success: true, books: [], user: user || null, date: today })
    }

    // Get user VIP level for reward amount
    const vip = Number(user?.vip) || Number(user?.vip_level) || 0
    const reward = VIP_CONFIG[vip]?.perBook || 0

    // Build lookup map with string keys to match Redis
    const booksMap = booksData.reduce((acc, b) => {
      acc[String(b.id)] = b
      return acc
    }, {})

    // Merge book IDs with full book data
    const books = Object.entries(taskHash).map(([bookId, status]) => {
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
      user,
      date: today
    })

  } catch (err) {
    console.error('tasks error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}