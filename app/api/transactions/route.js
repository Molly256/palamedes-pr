export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv() 

const toUiType = (t) => String(t || '').toLowerCase().replace(/_/g, ' ').trim()

const safeParse = (s) => { 
  if (typeof s === 'object') return s
  try { return JSON.parse(s) } catch { return null } 
}

// FIXED: Use Uganda date matching your book logic to prevent timezone drift
function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { type, phone, amount, method, withdrawPhone, withdrawName, bookTitle, vipLevel, id: customId } = body
    
    if (!type || !phone || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const id = customId || `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const status = (type === 'deposit' || type === 'withdraw') ? 'pending' : 'success'
    const today = getUgandaDateString(); // FIXED: Uses Uganda date key string

    const tx = {
      id, 
      type: type.toLowerCase(), 
      amount: String(amount), 
      status,
      createdAt: String(Date.now()), // Unix timestamp in ms
      phone, 
      method: method || '',
      withdrawPhone: withdrawPhone || '', 
      withdrawName: withdrawName || '',
      bookTitle: bookTitle || '', 
      vipLevel: String(vipLevel || '')
    }

    await redis.lpush(`tx:${phone}:${today}`, JSON.stringify(tx)) 
    
    if (status === 'pending') {
      await redis.lpush('pending_tx', id) 
    }
    
    return NextResponse.json({ success: true, transaction: tx })
    
  } catch (err) {
    console.error('POST /api/transactions 500:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const phone = request.nextUrl.searchParams.get('phone')
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 })

    const keys = await redis.keys(`tx:${phone}:*`)
    if (!keys.length) return NextResponse.json({ success: true, transactions: [] })

    const all = []
    for (const k of keys) {
      const items = await redis.lrange(k, 0, 99) 
      for (const item of items) {
        const tx = safeParse(item)
        if (tx) all.push(tx)
      }
    }

    const transactions = all
      .map(tx => {
        // FIXED: Safe parse timestamp whether it was written as milliseconds or ISO text
        let msTimestamp = String(Date.now());
        if (tx.createdAt) {
          msTimestamp = isNaN(tx.createdAt) ? String(Date.parse(tx.createdAt)) : String(tx.createdAt);
        }

        return {
          id: String(tx.id), 
          type: toUiType(tx.type), 
          amount: String(tx.amount),
          status: tx.status === 'completed' ? 'success' : tx.status,
          createdAt: msTimestamp, // FIXED: Now always a valid numeric string
          phone: tx.phone, 
          method: tx.method || '', 
          withdrawPhone: tx.withdrawPhone || '',
          withdrawName: tx.withdrawName || '', 
          bookTitle: tx.bookTitle || '',
          vipLevel: tx.vipLevel || ''
        };
      })
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt))

    return NextResponse.json({ 
      success: true, 
      transactions 
    }, { headers: { 'Cache-Control': 'no-store' } })
    
  } catch (err) {
    console.error('GET /api/transactions 500:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}