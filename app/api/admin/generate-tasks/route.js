import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import booksData from '../../../../data/books.json'

const TZ = 'Africa/Kampala'
const ADMIN_SECRET = process.env.ADMIN_SECRET // set this in Vercel env vars

function getUGDateStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

export async function GET(request) {
  // 1. Protect it - with logging for debugging
  const secret = request.nextUrl.searchParams.get('secret')
  const cleanSecret = secret?.trim()
  const cleanAdminSecret = ADMIN_SECRET?.trim()
  
  console.log('[DEBUG] Received secret:', cleanSecret)
  console.log('[DEBUG] Env secret:', cleanAdminSecret)
  console.log('[DEBUG] Match:', cleanSecret === cleanAdminSecret)
  
  if (cleanSecret !== cleanAdminSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = getUGDateStr()

    // 2. Get or create today's 4 books
    let dailyData = await kv.get(`tasks:daily:${today}`)
    if (!dailyData) {
      const dailyBooks = shuffle(booksData).slice(0, 4).map(b => ({
        id: String(b.id),
        title: b.title,
        cover: b.cover,
        preview: b.preview
      }))
      dailyData = { books: dailyBooks, date: today }
      await kv.set(`tasks:daily:${today}`, dailyData)
    }

    // 3. Get all VIP users
    const allKeys = await kv.keys('user:*')
    const userKeys = allKeys.filter(k => /^user:\d{10}$/.test(k))
    
    let createdFor = 0
    const pipeline = kv.pipeline()

    for (const key of userKeys) {
      const type = await kv.type(key)
      if (type !== 'hash') continue

      const user = await kv.hgetall(key)
      if (!user) continue
      
      const hasBoughtVIP = String(user.hasBoughtVIP).toLowerCase() === 'true'
      
      if (hasBoughtVIP) {
        const phone = key.replace('user:', '')
        const taskKey = `task:${phone}:${today}`
        
        pipeline.del(taskKey) // clear old junk
        
        for (const book of dailyData.books) {
          pipeline.hset(taskKey, String(book.id), 'pending')
        }
        createdFor++
      }
    }

    await pipeline.exec()

    return NextResponse.json({
      success: true,
      date: today,
      createdFor,
      books: dailyData.books.map(b => b.id),
      message: `Created tasks for ${createdFor} VIP users`
    })

  } catch (err) {
    console.error('[ADMIN GENERATE ERROR]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}