import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import booksData from '../../../../data/books.json'
export const dynamic = 'force-dynamic'

const TZ = 'Africa/Kampala'

function getUGDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

export async function GET() {
  try {
    const today = getUGDateStr()
    console.log('Backfilling tasks for', today)

    // 1. Pick 4 books for today
    const dailyBooks = shuffle(booksData).slice(0, 4).map(b => ({
      id: String(b.id),
      title: b.title,
      cover: b.cover,
      preview: b.preview
    }))

    await kv.set(`tasks:daily:${today}`, { books: dailyBooks, date: today })

    // 2. Scan all users with boughtvip=true
    let cursor = '0'
    let count = 0
    const pipeline = kv.pipeline()

    do {
      const [nextCursor, keys] = await kv.scan(cursor, { match: 'user:*', count: 100 })
      cursor = nextCursor

      for (const key of keys) {
        const user = await kv.hgetall(key)
        const phone = key.split(':')[1]
        
        if (user.boughtvip === true || user.boughtvip === 'true') {
          const taskKey = `task:${phone}:${today}`
          for (const book of dailyBooks) {
            pipeline.hset(taskKey, book.id, 'pending')
          }
          count++
        }
      }
    } while (cursor !== '0')

    if (count > 0) {
      await pipeline.exec()
    }

    return NextResponse.json({
      success: true,
      date: today,
      books: dailyBooks.length,
      assignedTo: count
    })

  } catch (err) {
    console.error('[BACKFILL ERROR]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}