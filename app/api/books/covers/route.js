import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const redis = Redis.fromEnv()

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export async function GET(req) {
  const { searchParams } = req.nextUrl 
  const phone = searchParams.get('phone')
  const date = searchParams.get('date') || getUgandaDateString()
  
  if (!phone) return NextResponse.json({ success: true, bookIds: [] })

  const setKey = `books:${phone}:${date}`
  const bookIds = await redis.smembers(setKey) // ['45130', '45304', '1342', '43']
  
  return NextResponse.json({ success: true, bookIds }) // <--- Just IDs. Nothing else
}