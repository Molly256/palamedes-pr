import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import booksData from '../../../../data/books.json'

export const dynamic = 'force-dynamic'
const TZ = 'Africa/Kampala'
const ADMIN_KEY = process.env.ADMIN_KEY

function getUGDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

export async function POST(req) {
  try {
    const { key } = await req.json()
    
    if (!key || key !== ADMIN_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const today = getUGDateStr()

    // Pick 4 random books from books.json
    const dailyBooks = shuffle(booksData).slice(0, 4).map(b => ({
      id: String(b.id),
      title: b.title,
      cover: b.cover,
      preview: b.preview
    }))

    // Save today's books for /tasks page
    await kv.set(`tasks:daily:${today}`, { books: dailyBooks, date: today })

    // Assign to all VIP users
    let cursor = '0'
    let count = 0
    const pipeline = kv.pipeline()

    do {
      const [nextCursor, keys] = await kv.scan(cursor, { match: 'user:*', count: 100 })
      cursor = nextCursor

      for (const key of keys) {
        // Skip non-hash keys to avoid WRONGTYPE error
        const type = await kv.type(key)
        if (type !== 'hash') continue

        const user = await kv.hgetall(key)
        if (!user || Object.keys(user).length === 0) continue

        const phone = key.split(':')[1]
        const isVip = user.boughtvip === true || user.boughtvip === 'true'

        if (isVip) {
          const taskKey = `task:${phone}:${today}`
          for (const book of dailyBooks) {
            pipeline.hset(taskKey, book.id, 'pending')
          }
          count++
        }
      }
    } while (cursor !== '0')

    if (count > 0) await pipeline.exec()

    return NextResponse.json({
      success: true,
      date: today,
      books: dailyBooks.length,
      usersUpdated: count
    })

  } catch (err) {
    console.error('Post-tasks error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}