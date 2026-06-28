export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import path from 'path'
import { promises as fs } from 'fs'

const redis = Redis.fromEnv()

const run = async () => {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })

  // 1. Read 4 random book IDs from public/data/books.json
  const booksPath = path.join(process.cwd(), 'public/data/books.json')
  const file = await fs.readFile(booksPath, 'utf-8')
  const books = JSON.parse(file) // [{id: "1", title: "..."}, ...]
  
  if (!Array.isArray(books) || books.length < 4) {
    return { success: false, message: 'Need at least 4 books in public/data/books.json' }
  }
  
  const bookIds = [...books].sort(() => 0.5 - Math.random()).slice(0, 4).map(b => String(b.id))

  // 2. Get only VIP users: hasBoughtVip === 'true'
  const userKeys = await redis.keys('user:*')
  const users = await Promise.all(userKeys.map(k => redis.hgetall(k)))
  const vipPhones = users.filter(u => u.hasBoughtVip === 'true' && u.phone).map(u => u.phone)

  if (vipPhones.length === 0) {
    return { success: true, message: 'No VIP users found', usersUpdated: 0, bookIds, date: today }
  }

  // 3. Write only the SET: books:phone:YYYY-MM-DD = [id1,id2,id3,id4]
  const pipeline = redis.pipeline()
  for (const phone of vipPhones) {
    const key = `books:${phone}:${today}`
    pipeline.del(key) // overwrite if run twice
    pipeline.sadd(key, ...bookIds)
  }
  await pipeline.exec()

  return {
    success: true,
    message: `Assigned 4 books to ${vipPhones.length} VIP users`,
    date: today,
    bookIds,
    usersUpdated: vipPhones.length
  }
}

export async function GET() {
  try {
    const result = await run()
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('Generate books error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST() {
  try {
    const result = await run()
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}