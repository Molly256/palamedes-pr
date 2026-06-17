import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import booksData from '../../../../data/books.json'

const TZ = 'Africa/Kampala'
const ADMIN_SECRET = 'vip-tasks-9k2m8x4z'

function getUGDateStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

function getUniqueBooks(count = 4) {
  const seen = new Set()
  const result = []
  
  for (const b of shuffle(booksData)) {
    const id = String(b.id)
    if (!seen.has(id)) {
      seen.add(id)
      result.push({
        id,
        title: b.title,
        cover: b.cover,
        preview: b.preview
      })
    }
    if (result.length === count) break
  }
  
  return result
}

export async function GET(request) {
  const secret = request.nextUrl.searchParams.get('secret')
  const force = request.nextUrl.searchParams.get('force') === '1'
  
  if (secret?.trim() !== ADMIN_SECRET?.trim()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = getUGDateStr()
    const dailyKey = `tasks:daily:${today}`

    // Delete and regenerate if force=1 or if data doesn't exist
    let dailyData = await kv.get(dailyKey)
    if (!dailyData || force) {
      const dailyBooks = getUniqueBooks(4)
      
      if (dailyBooks.length < 4) {
        return NextResponse.json({ 
          error: `Only ${dailyBooks.length} unique books found. Check books.json for duplicates.` 
        }, { status: 500 })
      }
      
      dailyData = { books: dailyBooks, date: today }
      await kv.set(dailyKey, dailyData)
    }

    // Get all VIP users
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
        
        pipeline.del(taskKey)
        
        for (const book of dailyData.books) {
          pipeline.hset(taskKey, book.id, 'pending')
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
      message: `Created tasks for ${createdFor} VIP users with ${dailyData.books.length} unique books`
    })

  } catch (err) {
    console.error('[ADMIN GENERATE ERROR]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}