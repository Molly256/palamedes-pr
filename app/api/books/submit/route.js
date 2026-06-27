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
  try {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    const date = searchParams.get('date') || getUgandaDateString()
    
    if (!phone) {
      return NextResponse.json({ success: true, books: [], user: null })
    }

    const setKey = `books:${phone}:${date}`
    const bookIds = await redis.smembers(setKey)
    
    if (!bookIds || bookIds.length === 0) {
      const user = await redis.hgetall(`user:${phone}`)
      return NextResponse.json({ 
        success: true, 
        books: [], 
        user: user ? { 
          ...user, 
          availableBalance: Number(user.availableBalance || 0), 
          vip: Number(user.vip || 0) 
        } : null 
      })
    }

    const books = await Promise.all(
      bookIds.slice(0, 4).map(async (id) => {
        const meta = booksMeta.find(m => String(m.id) === String(id)) || {}
        const bookKey = `book:${phone}:${date}:${id}`
        const bookData = await redis.hgetall(bookKey)
        
        return {
          bookId: id,
          title: meta.title || `Book ${id}`,
          author: meta.author || 'Unknown',
          cover: meta.cover || `/books/covers/${id}.jpg`,
          preview: meta.preview || 'No preview available',
          status: bookData?.status || 'pending'
        }
      })
    )

    const user = await redis.hgetall(`user:${phone}`)
    
    return NextResponse.json({ 
      success: true, 
      books, 
      user: user ? { 
        ...user, 
        availableBalance: Number(user.availableBalance || 0), 
        vip: Number(user.vip || 0) 
      } : null 
    }, { headers: { 'Cache-Control': 'no-store' } })

  } catch (err) {
    console.error('GET /api/books/data error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}