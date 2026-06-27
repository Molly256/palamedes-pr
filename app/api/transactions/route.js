import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const safeParse = (s) => { try { return JSON.parse(s) } catch { return null } }

export async function POST(req) {
  try {
    const body = await req.json()
    const { type, phone, amount, method, withdrawPhone, withdrawName, bookTitle, vipLevel } = body

    if (!type || !phone || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const id = `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const status = (type === 'deposit' || type === 'withdraw') ? 'pending' : 'success'

    const tx = {
      id,
      type: type.toLowerCase(),
      amount: String(amount),
      status,
      createdAt: String(Date.now()),
      phone,
      method: method || '',
      withdrawPhone: withdrawPhone || '',
      withdrawName: withdrawName || '',
      bookTitle: bookTitle || '',
      vipLevel: vipLevel || ''
    }

    // Save as hash so admin can hgetall tx:id
    await redis.hset(`tx:${id}`, tx)
    
    // Also keep per-user list for user history
    await redis.lpush(`tx:${phone}`, id)

    // Add to pending list if pending
    if (status === 'pending') {
      await redis.lpush('pending_tx', id)
    }

    return NextResponse.json({ success: true, transaction: tx })

  } catch (err) {
    console.error('POST /api/transactions error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const phone = request.nextUrl.searchParams.get('phone')
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 })

    // 1. READ FRESH FROM tx:phone LIST
    const items = await redis.lrange(`tx:${phone}`, 0, 99)
    const transactions = []
    
    for (const item of items) {
      let tx = null

      if (typeof item === 'string' && item.startsWith('tx_')) {
        // Case 1: It's an ID -> read hash. Like tx_1782559635885_iaiiu43claj
        tx = await redis.hgetall(`tx:${item}`)
      } else {
        // Case 2: It's raw JSON -> from book submit. Like {"type":"book_submission",...}
        tx = safeParse(item)
      }

      if (!tx || !tx.id) continue

      // 2. NORMALIZE: Make both formats match your page
      transactions.push({
        id: tx.id,
        type: tx.type === 'book_submission' ? 'daily income' : tx.type, // <- matches DAILY INCOME tab
        amount: String(tx.amount),
        status: tx.status === 'completed' ? 'success' : tx.status, // <- green color
        createdAt: String(tx.createdAt || new Date(tx.date).getTime()), // <- ms for formatUgandaTime
        phone: tx.phone || phone,
        method: tx.method || '',
        withdrawPhone: tx.withdrawPhone || '',
        withdrawName: tx.withdrawName || '',
        bookTitle: tx.bookTitle || (tx.bookId ? `Book ${tx.bookId}` : ''), // <- Book 40739 etc
        vipLevel: tx.vipLevel || ''
      })
    }

    return NextResponse.json({ success: true, transactions })
  } catch (err) {
    console.error('GET /api/transactions error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}