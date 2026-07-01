export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv() 

const toUiType = (t) => String(t || '').toLowerCase().replace(/_/g, ' ').trim()

const safeParse = (s) => { 
  if (typeof s === 'object') return s
  try { return JSON.parse(s) } catch { return null} 
}

// 2026-MM-DD full year Uganda
function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
}

// 2026-06-30 14:32 Uganda
function getUgandaDateTimeString() {
  return new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).slice(0,16).replace(',', ' ');
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { type, phone, amount, method, withdrawPhone, withdrawName, bookTitle, vipLevel, id: customId, note } = body
    
    if (!type || !phone || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const id = customId || `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const status = (type === 'deposit' || type === 'withdraw') ? 'pending' : 'success'
    const dateStr = getUgandaDateString(); // 2026-MM-DD
    const timeStr = getUgandaDateTimeString(); // 2026-MM-DD HH:mm

    const tx = {
      id, 
      type: String(type).toLowerCase(), // keep buy_vip, refund_vip as-is
      amount: String(amount), 
      status,
      createdAt: timeStr, // <- string under amount, not ms
      phone, 
      method: method || '',
      withdrawPhone: withdrawPhone || '', 
      withdrawName: withdrawName || '',
      bookTitle: bookTitle || '', 
      vipLevel: String(vipLevel || ''),
      note: note || ''
    }

    await redis.lpush(`tx:${phone}:${dateStr}`, JSON.stringify(tx)) // <- full year key
    
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

    // Scan full year keys only: 2026-MM-DD
    const [txKeys, incomeKeys] = await Promise.all([
      redis.keys(`tx:${phone}:2026-*`), // <- full year filter
      redis.keys(`income:${phone}:*`)
    ])

    const allKeys = [...txKeys, ...incomeKeys]
    if (!allKeys.length) return NextResponse.json({ success: true, transactions: [] })

    const all = []
    for (const k of allKeys) {
      const items = await redis.lrange(k, 0, 199) // bumped to 199 for more history
      for (const item of items) {
        const tx = safeParse(item)
        if (tx) all.push(tx)
      }
    }

    const transactions = all
      .map(tx => {
        let uiType = String(tx.type || '').toLowerCase().trim();
        if (uiType === 'daily_income' || uiType === 'book_income' || uiType === 'book income') {
          uiType = 'daily income'; // matches frontend tab
        } else {
          uiType = toUiType(tx.type); // buy_vip -> buy vip, refund_vip -> refund vip
        }

        return {
          id: String(tx.id), 
          type: uiType, 
          amount: String(tx.amount),
          note: tx.note || '',
          status: tx.status === 'completed' ? 'success' : tx.status,
          createdAt: tx.createdAt, // <- already string 2026-MM-DD HH:mm
          phone: tx.phone || phone, 
          method: tx.method || '', 
          withdrawPhone: tx.withdrawPhone || '',
          withdrawName: tx.withdrawName || '', 
          bookTitle: tx.bookTitle || '',
          vipLevel: tx.vipLevel || ''
        };
      })
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) // sort by string time desc

    return NextResponse.json({ 
      success: true, 
      transactions 
    }, { headers: { 'Cache-Control': 'no-store' } })
    
  } catch (err) {
    console.error('GET /api/transactions 500:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}