import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import fs from 'fs' 
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const redis = Redis.fromEnv()
const COVERS_DIR = path.join(process.cwd(), 'app', 'covers') // <-- app/covers/

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export async function GET(req) {
  try {
    const { searchParams } = req.nextUrl 
    
    const phone = searchParams.get('phone')
    const date = searchParams.get('date') || getUgandaDateString()
    
    if (!phone) {
      return NextResponse.json({ success: true, covers: [] })
    }

    // 1. Read book IDs from Redis: books:phone:YYYY-MM-DD SET
    const setKey = `books:${phone}:${date}`
    const bookIds = await redis.smembers(setKey) // ['45130', '45304', '1342', '43']
    
    if (!bookIds || bookIds.length === 0) {
      return NextResponse.json({ success: true, covers: [] })
    }

    // 2. Check app/covers/ for exact files: 45130.jpg, 45304.jpg etc
    const covers = [];
    for (const id of bookIds.slice(0, 4)) {
      const filePath = path.join(COVERS_DIR, `${id}.jpg`);
      if (fs.existsSync(filePath)) { // Only return if file actually exists
        covers.push({ 
          id: String(id), 
          cover: `/covers/${id}.jpg` // <-- public URL = app/covers/
        })
      }
    }
    
    return NextResponse.json({ success: true, covers }, {
      headers: { 'Cache-Control': 'no-store' }
    })
    
  } catch (err) {
    console.error('GET /api/books/covers error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}