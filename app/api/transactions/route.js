import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

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

    if (!phone) {
      return NextResponse.json({ error: 'Phone required' }, { status: 400 })
    }

    const txIds = await redis.lrange(`tx:${phone}`, 0, 99)
    const transactions = []
    
    for (const id of txIds) {
      const tx = await redis.hgetall(`tx:${id}`)
      if (tx && Object.keys(tx).length > 0) {
        transactions.push(tx)
      }
    }

    return NextResponse.json({ success: true, transactions })
  } catch (err) {
    console.error('GET /api/transactions error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}