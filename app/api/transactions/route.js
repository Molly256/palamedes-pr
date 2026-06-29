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

// Uses Uganda date matching your book logic to prevent timezone drift
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
    const today = getUgandaDateString();

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

    // 1. FIXED: Scan for BOTH transaction history keys and income tracking keys
    const [txKeys, incomeKeys] = await Promise.all([
      redis.keys(`tx:${phone}:*`),
      redis.keys(`income:${phone}:*`)
    ])

    const allKeys = [...txKeys, ...incomeKeys]
    if (!allKeys.length) return NextResponse.json({ success: true, transactions: [] })

    // 2. Read all data arrays across keys
    const all = []
    for (const k of allKeys) {
      const items = await redis.lrange(k, 0, 99) 
      for (const item of items) {
        const tx = safeParse(item)
        if (tx) all.push(tx)
      }
    }

    // 3. Normalize values, sanitize UI filter naming, and sort newest first
    const transactions = all
      .map(tx => {
        // Safe parse timestamp whether it was written as milliseconds or ISO text
        let msTimestamp = String(Date.now());
        if (tx.createdAt) {
          msTimestamp = isNaN(tx.createdAt) ? String(Date.parse(tx.createdAt)) : String(tx.createdAt);
        }

        // FIXED FOR FRONTEND TAB FILTERING: Force book incomes to map cleanly to UI tab keywords
        let uiType = String(tx.type || '').toLowerCase().trim();
        if (uiType === 'daily_income' || uiType === 'book_income' || uiType === 'book income') {
          uiType = 'daily income'; // Matches the text layout on your frontend tab
        } else {
          uiType = toUiType(tx.type);
        }

        return {
          id: String(tx.id), 
          type: uiType, 
          amount: String(tx.amount),
          status: tx.status === 'completed' ? 'success' : tx.status,
          createdAt: msTimestamp, 
          phone: tx.phone || phone, 
          method: tx.method || '', 
          withdrawPhone: tx.withdrawPhone || '',
          withdrawName: tx.withdrawName || '', 
          bookTitle: tx.bookTitle || '',
          vipLevel: tx.vipLevel || ''
        };
      })
      // Remove duplicate rows if the transaction lives inside both database lists
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
      // Sort with newest timestamps showing up first
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