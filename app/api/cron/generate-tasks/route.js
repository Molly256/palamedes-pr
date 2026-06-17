import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import booksData from '../../../../data/books.json'
export const dynamic = 'force-dynamic';

const TZ = 'Africa/Kampala'

function getUGDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

function getUGDayOfWeek(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(date)
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

async function getVipUserPhones() {
  const phones = await kv.smembers('vip:phones')
  return phones || []
}

export async function GET() {
  try {
    const today = getUGDateStr()
    const day = getUGDayOfWeek()

    // Only Mon-Fri
    if (day === 'Saturday' || day === 'Sunday') {
      return NextResponse.json({ success: true, message: 'Weekend, no tasks' })
    }

    // Pick 4 different books
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

    // Get all VIP users from set
    const phones = await getVipUserPhones()
    if (phones.length === 0) {
      return NextResponse.json({ success: true, message: 'No VIP users', distributedTo: 0 })
    }

    // Assign tasks as hash: task:phone:YYYY-MM-DD
    const pipeline = kv.pipeline()
    for (const phone of phones) {
      const taskKey = `task:${phone}:${today}`
      for (const book of dailyData.books) {
        pipeline.hset(taskKey, book.id, 'pending')
      }
    }
    await pipeline.exec()

    return NextResponse.json({
      success: true,
      date: today,
      books: dailyData.books.length,
      distributedTo: phones.length
    })

  } catch (err) {
    console.error('[CRON ERROR]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}