import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import booksData from '../../../data/books.json'

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

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')

    if (!phone) {
      return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    const today = getUGDateStr()
    const taskKey = `task:${phone}:${today}`

    // Get task status hash from Redis
    const taskHash = await kv.hgetall(taskKey)

    if (!taskHash || Object.keys(taskHash).length === 0) {
      return NextResponse.json({ success: true, books: [] })
    }

    // Get user VIP level for reward amount
    const userKey = `user:${phone}`
    const user = await kv.hgetall(userKey)
    const vip = Number(user?.vip) || Number(user?.vip_level) || 0
    const reward = VIP_CONFIG[vip]?.perBook || 0

    // Merge book IDs with full book data
    const books = Object.entries(taskHash).map(([bookId, status]) => {
      const book = booksData.find(b => String(b.id) === String(bookId))
      return {
        id: bookId,
        title: book?.title || '',
        cover: book?.cover || '',
        preview: book?.preview || '',
        status,
        reward
      }
    })

    return NextResponse.json({
      success: true,
      books,
      date: today
    })

  } catch (err) {
    console.error('tasks error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}