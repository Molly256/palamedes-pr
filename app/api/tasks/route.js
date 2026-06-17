import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import booksData from '../../../data/books.json'

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

const VIP_CONFIG = {
 0: { books: 4, perBook: 625 },
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

export async function GET() {
  try {
    const today = getUGDateStr()
    const day = getUGDayOfWeek()

    if (day === 'Saturday' || day === 'Sunday') {
      return NextResponse.json({ success: false, message: 'No tasks on weekends' })
    }

    const allKeys = await kv.keys('user:*')
    let created = 0
    const errors = []
    const pipeline = kv.pipeline()

    for (const key of allKeys) {
      try {
        const user = await kv.hgetall(key)
        if (!user) continue

        const hasVip = user.hasBoughtVIP === true || user.hasBoughtVIP === 'true'
        if (!hasVip) continue

        const phone = key.replace('user:', '')
        const vip = Number(user.vip) || Number(user.vip_level) || 0
        const config = VIP_CONFIG[vip] || VIP_CONFIG[0]
        const taskKey = `task:${phone}:${today}`

        // Skip if tasks already exist for today
        const existing = await kv.hgetall(taskKey)
        if (existing && Object.keys(existing).length > 0) continue

        // Pick random books based on VIP level
        const selectedBooks = shuffle(booksData).slice(0, config.books)
        const taskHash = {}
        selectedBooks.forEach(b => {
          taskHash[String(b.id)] = 'pending'
        })

        pipeline.hset(taskKey, taskHash)
        created++

      } catch (e) {
        errors.push({ key, error: e.message })
      }
    }

    if (created > 0) await pipeline.exec()

    return NextResponse.json({
      success: true,
      message: `Created tasks for ${created} users`,
      date: today,
      day,
      created,
      errors
    })

  } catch (err) {
    console.error('post-tasks error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}