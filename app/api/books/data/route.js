import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import booksMeta from '@/public/data/books.json'

const redis = Redis.fromEnv()
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')
  const date = searchParams.get('date') || getUgandaDateString()
  
  if (!phone) return NextResponse.json({ success: true, books: [], user: null })

  // 1. Read IDs from Redis SET: books:0753520252:2026-06-27
  const key = `books:${phone}:${date}`
  const bookIds = await redis.smembers(key) // ['40739','1260','16389','11']
  
  if (!bookIds || bookIds.length === 0) {
    const user = await redis.hgetall(`user:${phone}`)
    return NextResponse.json({ success: true, books: [], user })
  }

  // 2. Take only first 4 IDs and get exact data from books.json
  const books = bookIds.slice(0, 4).map(id => {
    const meta = booksMeta.find(m => String(m.id) === id)
    return {
      bookId: id,
      title: meta?.title || `Book ${id}`,
      author: meta?.author || 'Unknown',
      reward: Number(meta?.reward || 0),
      preview: meta?.preview || 'No preview available',
      cover: `/books/covers/${id}.jpg`,
      status: 'pending' // frontend will handle status later
    }
  })

  // 3. Get user for balance/VIP
  const user = await redis.hgetall(`user:${phone}`)
  
  return NextResponse.json({ 
    success: true, 
    books, 
    user: user ? { ...user, availableBalance: Number(user.availableBalance || 0), vip: Number(user.vip || 0) } : null 
  }, { headers: { 'Cache-Control': 'no-store' } })
}