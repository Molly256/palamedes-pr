import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import booksData from '../../../data/books.json'

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
  const today = getUGDateStr()
  const day = getUGDayOfWeek()

  // Only Mon-Fri
  if (day === 'Saturday' || day === 'Sunday') {
    return NextResponse.json({ success: true, message: 'Weekend, no tasks' })
  }

  // Pick 4 random books from your books.json
  const dailyBooks = shuffle(booksData).slice(0, 4).map(b => ({
    id: String(b.id),
    title: b.title,
    cover: b.cover,
    preview: b.preview
  }))

  await kv.set(`tasks:daily:${today}`, { books: dailyBooks, date: today })

  return NextResponse.json({ success: true, date: today, books: dailyBooks })
}