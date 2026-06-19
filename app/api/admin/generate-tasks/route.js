import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const TZ = 'Africa/Kampala'
const ADMIN_SECRET = 'vip-tasks-9k2m8x4z'

function getUGDateStr() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date())
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5)
}

async function getBooksData() {
  const filePath = path.join(process.cwd(), 'public', 'data', 'books.json')
  
  try {
    const file = fs.readFileSync(filePath, 'utf-8')
    const books = JSON.parse(file)
    
    return books.map(b => ({
      id: String(b.id),
      title: b.title,
      author: b.author,
      cover: b.cover,
      preview: b.preview
    }))
  } catch (err) {
    throw new Error(`Failed to read books.json: ${err.message}`)
  }
}

async function getUniqueBooks(count = 4) {
  const booksData = await getBooksData()
  
  if (booksData.length < count) {
    throw new Error(`Not enough books. Found ${booksData.length}, need ${count}`)
  }

  const seen = new Set()
  const result = []
  
  for (const b of shuffle(booksData)) {
    if (!seen.has(b.id)) {
      seen.add(b.id)
      result.push(b)
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

    let dailyData = await kv.get(dailyKey)
    if (!dailyData || force) {
      const dailyBooks = await getUniqueBooks(4)
      dailyData = { books: dailyBooks, date: today }
      await kv.set(dailyKey, dailyData)
    }

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
          pipeline.hset(taskKey, book.id, JSON.stringify({
            status: 'pending',
            title: book.title,
            author: book.author,
            cover: book.cover,
            preview: book.preview
          }))
        }
        createdFor++
      }
    }

    await pipeline.exec()

    return NextResponse.json({
      success: true,
      date: today,
      createdFor,
      books: dailyData.books.map(b => ({ id: b.id, title: b.title, cover: b.cover })),
      message: `Created tasks for ${createdFor} VIP users with 4 unique books`
    })

  } catch (err) {
    console.error('[ADMIN GENERATE ERROR]', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}