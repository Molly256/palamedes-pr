import { NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import booksMeta from '@/public/data/books.json'
import fs from 'fs'
import path from 'path'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')
  const date = searchParams.get('date')
  
  if (!phone || !date) return NextResponse.json({ success: true, books: [], user: null })
  
  const key = `books:today:UGX:${date}:${phone}`
  const rawBooks = await redis.lrange(key, 0, 3)
  const booksFromRedis = rawBooks.map(b => {
    try { return typeof b === 'string' ? JSON.parse(b) : b } 
    catch { return { bookId: String(b) } }
  })
  const idsFromRedis = booksFromRedis.map(b => String(b.bookId))

  let realIds = new Set()
  try {
    realIds = new Set(
      fs.readdirSync(path.join(process.cwd(), 'public', 'books', 'covers'))
        .filter(f => f.toLowerCase().endsWith('.jpg'))
        .map(f => path.parse(f).name)
    )
  } catch {}

  const books = idsFromRedis
    .filter(id => realIds.has(id))
    .slice(0, 4)
    .map(id => {
      const meta = booksMeta.find(m => String(m.id) === id)
      const r = booksFromRedis.find(x => String(x.bookId) === id)
      return {
        bookId: id,
        status: r?.status || 'pending',
        reward: Number(r?.reward ?? meta?.reward ?? 0),
        title: meta?.title || `Book ${id}`,
        author: meta?.author || 'Unknown',
        preview: meta?.preview || 'No preview available',
        cover: `/books/covers/${id}.jpg`
      }
    })

  const user = await redis.hgetall(`user:${phone}`)
  return NextResponse.json({ success: true, books, user }, { headers: { 'Cache-Control': 'no-store' } })
}