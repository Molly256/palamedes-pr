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

    console.log('Daily books for', today, ':', dailyData.books.map(b => b.id))

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
      
      const hasBoughtVIP = String(user.hasBoughtVIP).toLowerCase() === 'true'
      
      if (hasBoughtVIP) {
        const phone = key.replace('user:', '')
        const taskKey = `task:${phone}:${today}`
        
        // Delete old hash first to remove junk
        pipeline.del(taskKey)

        // Add only book IDs with status pending
       for (const book of dailyData.books) {
    // Dynamically creates field name: "Book1 title cover", "Book2 title cover", etc.
    const fieldName = `Book${book.id} title cover`;
    const statusValue = 'pending' 
    
    console.log('WRITING', taskKey, 'field:', fieldName, 'value:' statusValue');
    pipeline.hset(taskKey, { [fieldName]: statusValue });
}        createdFor++
        console.log('Queued tasks for:', phone)
      } else {
        console.log('Skipping', key, 'hasBoughtVIP:', user.hasBoughtVIP)
      }
    }

    await pipeline.exec()

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