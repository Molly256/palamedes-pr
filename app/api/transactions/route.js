export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv() 

const getLabel = (tx) => {
  const t = String(tx.type || '').toLowerCase()
  if (t === 'buy_vip' || t === 'vip') return `VIP ${tx.vipLevel || ''} Purchase`.trim()
  if (t === 'deposit') return 'Deposit'
  if (t === 'withdraw') return 'Withdraw'
  if (t === 'refund_vip') return 'VIP Refund'
  if (t === 'daily_income' || t === 'book_income') return 'Daily Income'
  return tx.type ? tx.type.replace(/_/g,' ').toUpperCase() : 'Transaction'
}

const safeParse = (s) => { 
  if (typeof s === 'object') return s
  try { return JSON.parse(s) } catch { return null} 
}

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
}

function getUgandaDateTimeString() {
  return new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).slice(0,16).replace(',', ');
}

export async function POST(req) {
  try {
    const body = await req.json()
    const { type, phone, amount, method, withdrawPhone, withdrawName, bookTitle, vipLevel, id: customId, note } = body
    
    if (!type || !phone || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const id = customId || `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const status = (type === 'deposit' || type === 'withdraw') ? 'pending' : 'success' // VIP = success, Deposit = pending
    const dateStr = getUgandaDateString();
    const timeStr = getUgandaDateTimeString();

    const tx = {
      id, 
      type: String(type).toLowerCase(), // keep buy_vip in DB
      label: getLabel({type, vipLevel}), // NEW: add label for UI
      amount: String(amount), 
      status,
      createdAt: timeStr,
      phone, 
      method: method || '',
      withdrawPhone: withdrawPhone || '', 
      withdrawName: withdrawName || '',
      bookTitle: bookTitle || '', 
      vipLevel: String(vipLevel || ''),
      note: note || ''
    }

    await redis.lpush(`tx:${phone}:${dateStr}`, JSON.stringify(tx))
    
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

    const [txKeys, incomeKeys] = await Promise.all([
      redis.keys(`tx:${phone}:2026-*`),
      redis.keys(`income:${phone}:*`)
    ])

    const allKeys = [...txKeys, ...incomeKeys]
    if (!allKeys.length) return NextResponse.json({ success: true, transactions: [] })

    const all = []
    for (const k of allKeys) {
      const items = await redis.lrange(k, 0, 199)
      for (const item of items) {
        const tx = safeParse(item)
        if (tx) all.push(tx)
      }
    }

    const transactions = all
      .map(tx => {
        let uiType = String(tx.type || '').toLowerCase().trim();
        // MAP buy_vip -> vip so frontend VIP tab works
        if (uiType === 'buy_vip') uiType = 'vip' 
        if (uiType === 'daily_income' || uiType === 'book_income') uiType = 'daily income'

        return {
          id: String(tx.id), 
          type: uiType, // vip, deposit, withdraw, daily income
          label: tx.label || getLabel(tx), // NEW: fallback for old tx
          amount: String(tx.amount),
          note: tx.note || '',
          status: tx.status === 'completed' ? 'success' : tx.status, // pending/success/failed
          createdAt: tx.createdAt,
          phone: tx.phone || phone, 
          method: tx.method || '', 
          withdrawPhone: tx.withdrawPhone || '',
          withdrawName: tx.withdrawName || '', 
          bookTitle: tx.bookTitle || '',
          vipLevel: tx.vipLevel || ''
        };
      })
      .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))

    return NextResponse.json({ 
      success: true, 
      transactions 
    }, { headers: { 'Cache-Control': 'no-store' } })
    
  } catch (err) {
    console.error('GET /api/transactions 500:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}