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

export async function POST(req) {
  try {
    const body = await req.json()
    const { type, phone, amount, method, withdrawPhone, withdrawName, bookTitle, vipLevel, id: customId } = body
    
    if (!type || !phone || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const id = customId || `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const status = (type === 'deposit' || type === 'withdraw') ? 'pending' : 'success'
    const today = new Date().toISOString().slice(0, 10) // yy-mm-dd format: 2026-06-29

    const tx = {
      id, 
      type: type.toLowerCase(), 
      amount: String(amount), 
      status,
      createdAt: String(Date.now()), // <- ms, works with frontend `new Date()`
      phone, 
      method: method || '',
      withdrawPhone: withdrawPhone || '', 
      withdrawName: withdrawName || '',
      bookTitle: bookTitle || '', 
      vipLevel: String(vipLevel || '')
    }

    // 1. SOURCE OF TRUTH: Write to tx:phone:yy-mm-dd
    await redis.lpush(`tx:${phone}:${today}`, JSON.stringify(tx)) 
    
    // 2. ADMIN QUEUE: Only store the id
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

    // 1. Get all daily keys: tx:phone:*
    const keys = await redis.keys(`tx:${phone}:*`)
    if (!keys.length) return NextResponse.json({ success: true, transactions: [] })

    // 2. Read all lists
    const all = []
    for (const k of keys) {
      const items = await redis.lrange(k, 0, 99) // 99 per day max
      for (const item of items) {
        const tx = safeParse(item)
        if (tx) all.push(tx)
      }
    }

    // 3. Normalize + sort newest first
    const transactions = all
      .map(tx => ({
        id: String(tx.id), 
        type: toUiType(tx.type), // system_increase -> system increase
        amount: String(tx.amount),
        status: tx.status === 'completed' ? 'success' : tx.status,
        createdAt: String(tx.createdAt), // ms
        phone: tx.phone, 
        method: tx.method || '', 
        withdrawPhone: tx.withdrawPhone || '',
        withdrawName: tx.withdrawName || '', 
        bookTitle: tx.bookTitle || '',
        vipLevel: tx.vipLevel || ''
      }))
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