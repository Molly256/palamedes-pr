import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const redis = Redis.fromEnv()

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')
  const date = searchParams.get('date') || getUgandaDateString()
  
  if (!phone) return NextResponse.json({ success: true, bookIds: [] })

  // This is the only Redis read. Whatever is in the set comes out.
  const bookIds = await redis.smembers(`books:${phone}:${date}`) 
  
  return NextResponse.json({ success: true, bookIds }, { 
    headers: { 'Cache-Control': 'no-store' } 
  })
}