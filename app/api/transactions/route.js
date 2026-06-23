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

    const tx = {
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: type.toLowerCase(),
      amount: String(amount),
      status: (type === 'deposit' || type === 'withdraw') ? 'pending' : 'success',
      createdAt: String(Date.now()),
      phone,
      method: method || '',
      withdrawPhone: withdrawPhone || '',
      withdrawName: withdrawName || '',
      bookTitle: bookTitle || '',
      vipLevel: vipLevel || ''
    }

    await redis.lpush(`tx:${phone}`, JSON.stringify(tx))
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

    const txs = await redis.lrange(`tx:${phone}`, 0, 99)
    
    const parsed = txs
      .map(t => {
        try {
          return typeof t === 'string' ? JSON.parse(t) : t
        } catch {
          return null
        }
      })
      .filter(Boolean)

    return NextResponse.json({ success: true, transactions: parsed })
  } catch (err) {
    console.error('GET /api/transactions error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}