export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

// FIX: Use fromEnv() -> reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
const redis = Redis.fromEnv() 

const toUiType = (t) => String(t || '').toLowerCase().replace(/_/g, ' ').trim()

const safeParse = (s) => { 
  if (typeof s === 'object') return s
  try { return JSON.parse(s) } catch { return null } 
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
      vipLevel: String(vipLevel || '')
    }

    // SOURCE OF TRUTH: Store full JSON in the list
    await redis.lpush(`tx:${phone}`, JSON.stringify(tx)) 
    
    return NextResponse.json({ success: true, transaction: tx })
    
  } catch (err) {
    console.error('POST /api/transactions 500:', err.message) // Check Vercel logs
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(request) {
  try {
    const phone = request.nextUrl.searchParams.get('phone')
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 })

    // SOURCE OF TRUTH: ONLY tx:phone LIST
    const items = await redis.lrange(`tx:${phone}`, 0, 199) // last 200 txs
    
    const transactions = items
      .map(safeParse)
      .filter(Boolean)
      .map(tx => ({
        id: String(tx.id), 
        type: toUiType(tx.type), // daily income, deposit, etc
        amount: String(tx.amount),
        status: tx.status === 'completed' ? 'success' : tx.status,
        createdAt: String(tx.createdAt),
        phone: tx.phone, 
        method: tx.method || '', 
        withdrawPhone: tx.withdrawPhone || '',
        withdrawName: tx.withdrawName || '', 
        bookTitle: tx.bookTitle || '',
        vipLevel: tx.vipLevel || ''
      }))
      .sort((a, b) => Number(b.createdAt) - Number(a.createdAt)) // newest first

    return NextResponse.json({ 
      success: true, 
      transactions 
    }, { headers: { 'Cache-Control': 'no-store' } })
    
  } catch (err) {
    console.error('GET /api/transactions 500:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}