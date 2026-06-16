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
  const phones = []
  let cursor = '0'

  do {
    const [nextCursor, keys] = await kv.scan(cursor, { match: 'user:*', count: 100 })
    cursor = nextCursor

    for (const key of keys) {
      const user = await kv.hgetall(key)
      const isVip = user.vip === true || user.vip === 'true' || Number(user.vip_level || 0) > 0
      if (isVip) {
        phones.push(key.split(':')[1])
      }
    }
  } while (cursor!== '0')

  return phones
}

export async function GET() {
  const today = getUGDateStr()
  const day = getUGDayOfWeek()

  // Only Mon-Fri
  if (day === 'Saturday' || day === 'Sunday') {
    return NextResponse.json({ success: true, message: 'Weekend, no tasks' })
  }

  // Pick 4 different books
  const dailyBooks = shuffle(booksData).slice(0, 4).map(b => ({
    id: String(b.id),
    title: b.title,
    cover: b.cover,
    preview: b.preview
  }))

  await kv.set(`tasks:daily:${today}`, { books: dailyBooks, date: today })

  // Get all VIP users and assign the same 4 books
  const phones = await getVipUserPhones()

  const pipeline = kv.pipeline()
  for (const phone of phones) {
    pipeline.set(`tasks:user:${phone}:${today}`, {
      books: dailyBooks,
      date: today,
      assignedAt: new Date().toISOString()
    })
  }
  await pipeline.exec()

  return NextResponse.json({
    success: true,
    date: today,
    books: dailyBooks,
    distributedTo: phones.length
  })
}