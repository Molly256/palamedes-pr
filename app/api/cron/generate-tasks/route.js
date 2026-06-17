import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import booksData from '../../../../data/books.json'
export const dynamic = 'force-dynamic';

const TZ = 'Africa/Kampala'

function getUGDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date) // yyyy-mm-dd
}

function getUGDayOfWeek(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(date)
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

export async function GET() {
  try {
    const today = getUGDateStr() // 2026-06-17
    const day = getUGDayOfWeek()

    if (day === 'Saturday' || day === 'Sunday') {
      return NextResponse.json({ success: true, message: 'Weekend, no tasks' })
    }

    // Create today's 4 books if not exists
    let dailyData = await kv.get(`tasks:daily:${today}`)
    if (!dailyData) {
      const dailyBooks = shuffle(booksData).slice(0, 4).map(b => ({
        id: String(b.id),
        title: b.title,
        cover: b.cover,
        preview: b.preview
      }))
      dailyData = { books: dailyBooks, date: today }
      await kv.set(`tasks:daily:${today}`, dailyData)
    }

    // Create task:phone:yyyy-mm-dd for all VIP users
    const allKeys = await kv.keys('user:*')
    let createdFor = 0
    const pipeline = kv.pipeline()

    for (const key of allKeys) {
      const user = await kv.hgetall(key)
      if (!user) continue
      
      if (user.hasboughtvip === true || user.hasboughtvip === 'true') {
        const phone = key.replace('user:', '')
        const taskKey = `task:${phone}:${today}`
        
        // Skip if tasks already exist for today
        const existing = await kv.hgetall(taskKey)
        if (existing && Object.keys(existing).length > 0) continue

        for (const book of dailyData.books) {
          pipeline.hset(taskKey, book.id, 'pending')
        }
        createdFor++
      }
    }

    if (createdFor > 0) await pipeline.exec()

    return NextResponse.json({
      success: true,
      date: today,
      createdFor,
      message: `Created task:phone:${today} for ${createdFor} users`
    })

  } catch (err) {
    console.error('[CRON ERROR]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}