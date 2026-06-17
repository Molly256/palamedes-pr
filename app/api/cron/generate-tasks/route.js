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
    const today = getUGDateStr()
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

    // Get only real user keys: user:0753520252
    const allKeys = await kv.keys('user:*')
    const userKeys = allKeys.filter(k => /^user:\d{10}$/.test(k))
    console.log('Found user keys:', userKeys)
    
    let createdFor = 0
    const pipeline = kv.pipeline()

    for (const key of userKeys) {
      const type = await kv.type(key)
      if (type !== 'hash') continue

      const user = await kv.hgetall(key)
      if (!user) continue
      
      console.log(key, 'data:', user)
      
      const isVIP = String(user.hasBoughtVIP).toLowerCase() === 'true'
      console.log(key, 'isVIP:', isVIP, 'raw value:', user.hasBoughtVIP)
      
      if (isVIP) {
        const phone = key.replace('user:', '')
        const taskKey = `task:${phone}:${today}`
        
        // Delete old hash first to remove 0:4, 1:0 junk
        pipeline.del(taskKey)

        // Add only book IDs
        for (const book of dailyData.books) {
          pipeline.hset(taskKey, book.id, 'pending')
        }
        createdFor++
        console.log('Queued tasks for:', phone)
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