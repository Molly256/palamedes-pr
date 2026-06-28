import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const redis = Redis.fromEnv()

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export async function GET(req) {
  try {
    const { searchParams } = req.nextUrl // <-- NO new URL()
    
    const phone = searchParams.get('phone')
    const date = searchParams.get('date') || getUgandaDateString()
    
    if (!phone) {
      return NextResponse.json({ success: true, covers: [] })
    }

    // 1. Read book IDs from Redis: books:phone:YYYY-MM-DD SET
    const setKey = `books:${phone}:${date}`
    const bookIds = await redis.smembers(setKey) // ['3', '17', '8', '41']
    
    if (!bookIds || bookIds.length === 0) {
      return NextResponse.json({ success: true, covers: [] })
    }
    
    const coversPath = path.join(process.cwd(), 'public', 'books', 'covers')

    // 2. For each ID, check public/books/covers/{id}.jpg exists
    const covers = bookIds.slice(0, 4).map(id => {
      const filePath = path.join(coversPath, `${id}.jpg`)
      const exists = fs.existsSync(filePath)
      return { 
        id: String(id), 
        cover: exists ? `/books/covers/${id}.jpg` : '/books/covers/default.jpg' 
      }
    })
    
    return NextResponse.json({ success: true, covers }, {
      headers: { 'Cache-Control': 'no-store' }
    })
    
  } catch (err) {
    console.error('GET /api/books/covers error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}