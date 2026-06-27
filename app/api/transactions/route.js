import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const toUiType = (t) => {
  const x = String(t || '').toLowerCase()
  if (x === 'book_submission') return 'daily income' // <- KEY FIX
  return x
}

const safeParse = (s) => { 
  if (typeof s === 'object') return s
  try { return JSON.parse(s) } catch { return null } 
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { type, phone, amount, method, withdrawPhone, withdrawName, bookTitle, vipLevel } = body
    if (!type || !phone || !amount) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })

    const id = `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const status = (type === 'deposit' || type === 'withdraw') ? 'pending' : 'success'

    const tx = {
      id, type: type.toLowerCase(), amount: String(amount), status,
      createdAt: String(Date.now()), phone, method: method || '',
      withdrawPhone: withdrawPhone || '', withdrawName: withdrawName || '',
      bookTitle: bookTitle || '', vipLevel: vipLevel || ''
    }

    await redis.hset(`tx:${id}`, tx)
    await redis.lpush(`tx:${phone}`, id) 
    if (status === 'pending') await redis.lpush('pending_tx', id)
    return NextResponse.json({ success: true, transaction: tx })
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const phone = request.nextUrl.searchParams.get('phone')
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 })

    const transactions = []
    const seenIds = new Set()

    // 1. FROM tx:phone LIST
    const items = await redis.lrange(`tx:${phone}`, 0, 99)
    for (const raw of items) {
      let tx = null
      if (typeof raw === 'string' && raw.startsWith('tx_')) {
        tx = await redis.hgetall(`tx:${raw}`)
      } else {
        tx = safeParse(raw) // your book_submission JSON
      }
      if (!tx?.id) continue
      
      seenIds.add(String(tx.id))
      transactions.push({
        id: String(tx.id), 
        type: toUiType(tx.type), // <- book_submission becomes daily income
        amount: String(tx.amount), // <- 625
        status: tx.status === 'completed' ? 'success' : tx.status, // <- green
        createdAt: String(tx.createdAt || new Date(tx.date).getTime()), // <- ms
        phone, method: tx.method || '', withdrawPhone: tx.withdrawPhone || '',
        withdrawName: tx.withdrawName || '', 
        bookTitle: tx.bookTitle || (tx.bookId ? `Book ${tx.bookId}` : ''),
        vipLevel: tx.vipLevel || ''
      })
    }

    // 2. FROM book:phone:YYYY-MM-DD:* HASHES <- your screenshot
    const bookKeys = await redis.keys(`book:${phone}:*`)
    for (const key of bookKeys) {
      const b = await redis.hgetall(key)
      if (b?.submittedAt && b.status === 'submitted') {
        const id = `book_${b.submittedAt}`
        if (!seenIds.has(id)) {
          transactions.push({
            id, type: 'daily income', // <- forced to daily income
            amount: String(b.reward || 625), 
            status: 'success', 
            createdAt: String(b.submittedAt),
            phone, bookTitle: b.title || `Book ${b.bookid}`,
            method: '', withdrawPhone: '', withdrawName: '', vipLevel: b.vipLevel || ''
          })
        }
      }
    }

    transactions.sort((a, b) => Number(b.createdAt) - Number(a.createdAt))
    return NextResponse.json({ success: true, transactions })
  } catch (err) {
    console.error('GET /api/transactions error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}