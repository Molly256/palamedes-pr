export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv() 

const getLabel = (tx) => {
  const t = String(tx.type || '').toLowerCase().trim()
  if (t === 'buy_vip' || t === 'vip') return `VIP ${tx.vipLevel || ''} Purchase`.trim()
  if (t === 'deposit') return 'Deposit'
  if (t === 'withdraw') return 'Withdraw'
  if (t === 'refund_vip') return 'VIP Refund'
  if (t === 'daily_income' || t === 'book_income') return 'Daily Income'
  if (t === 'shares') return 'Shares Purchase'
  if (t === 'shares_collected' || t === 'collect_hot') return 'Shares Payout Collected'
  if (t === 'system_increase') return 'Registration Reward'
  
  if (t === 'team_a_payout') return 'Team A Direct Commission'
  if (t === 'team_b_payout') return 'Team B Indirect Commission'
  if (t === 'team_c_payout') return 'Team C Indirect Commission'
  if (t === 'commission') return 'Team Commission'

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
  return new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).slice(0,16).replace(',', '');
}

// =========================================================================
// POST: Save transaction entry and update availableBalance atomically
// =========================================================================
export async function POST(req) {
  try {
    const body = await req.json()
    const { type, phone, amount, method, withdrawPhone, withdrawName, bookTitle, vipLevel, id: customId, note } = body
    
    if (!type || !phone || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let amt = Number(amount)
    if (isNaN(amt) || amt <= 0) {
      return NextResponse.json({ error: 'Invalid amount value' }, { status: 400 })
    }

    const cleanType = String(type).toLowerCase().trim()
    const isWithdrawal = cleanType === 'withdraw'

    if (isWithdrawal) {
      const ugandaTimeStr = new Date().toLocaleString("en-US", { timeZone: "Africa/Kampala" })
      const ugandaDate = new Date(ugandaTimeStr)
      
      // 🛑 WEEKEND RESTRICTION CHECK: 0 = Sunday, 6 = Saturday
      const day = ugandaDate.getDay()
      if (day === 0 || day === 6) {
        return NextResponse.json({ error: 'No time for withdraw on weekends! Please withdraw from Monday to Friday.' }, { status: 400 })
      }

      const hours = ugandaDate.getHours()
      const minutes = ugandaDate.getMinutes()

      const totalMinutes = hours * 60 + minutes
      const startMinutes = 10 * 60 
      const endMinutes = 17 * 60   

      if (totalMinutes < startMinutes || totalMinutes > endMinutes) {
        return NextResponse.json({ error: 'Withdrawals are only open 10:00 AM - 5:00 PM Ugandan Time.' }, { status: 400 })
      }
    }

    const userKey = `user:${phone}`
    const grossDeduction = isWithdrawal ? Math.round(amt / 0.9) : amt

    if (isWithdrawal) {
      const currentAvailableBalance = Number(await redis.hget(userKey, 'availableBalance') || 0)
      if (grossDeduction > currentAvailableBalance) {
        return NextResponse.json({ error: 'Insufficient availableBalance' }, { status: 400 })
      }
      await redis.hincrby(userKey, 'availableBalance', -grossDeduction)
    }

    const id = customId || `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`
    
    let status = 'success'
    if (cleanType === 'deposit' || isWithdrawal) status = 'pending'
    if (cleanType === 'completed' || cleanType === 'success') status = 'success'

    const dateStr = getUgandaDateString();
    const timeStr = getUgandaDateTimeString();

    const tx = {
      id, 
      type: cleanType, 
      label: getLabel({type: cleanType, vipLevel}), 
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

    const txString = JSON.stringify(tx)
    const dayKey = `tx:${phone}:${dateStr}`
    const historyKey = `tx:${phone}:history`

    const pipeline = redis.pipeline()
    
    pipeline.lpush(dayKey, txString)
    pipeline.lpush(historyKey, txString)
    
    if (status === 'pending') {
      pipeline.sadd('admin:pending_txs', dayKey)
      pipeline.lpush('pending_tx', id) 
    }
    
    await pipeline.exec()
    return NextResponse.json({ success: true, transaction: tx })
    
  } catch (err) {
    console.error('POST /api/transactions 500:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// =========================================================================
// GET: Fetch user transactions strictly from the single lifetime history key
// =========================================================================
export async function GET(request) {
  try {
    const phone = request.nextUrl.searchParams.get('phone')
    if (!phone) return NextResponse.json({ error: 'Phone required' }, { status: 400 })

    const historyKey = `tx:${phone}:history`

    // Read details and history in parallel cleanly without executing sync loops
    const [userHash, rawItems] = await Promise.all([
      redis.hgetall(`user:${phone}`) || {},
      redis.lrange(historyKey, 0, 399) || []
    ])
    
    const availableBalance = Number(userHash.availableBalance || 0)

    const transactions = rawItems
     .map(item => {
        const tx = safeParse(item)
        if (!tx) return null

        let uiType = String(tx.type || '').toLowerCase().trim();
        if (uiType === 'buy_vip') uiType = 'vip' 
        if (uiType === 'daily_income' || uiType === 'book_income') uiType = 'daily income'
        if (uiType === 'shares') uiType = 'shares'
        if (uiType === 'shares_collected') uiType = 'shares'
        if (uiType === 'system_increase') uiType = 'system_increase'
        
        if (uiType === 'team_a_payout') uiType = 'team_a_payout'
        if (uiType === 'team_b_payout') uiType = 'team_b_payout'
        if (uiType === 'team_c_payout') uiType = 'team_c_payout'
        if (uiType === 'commission') uiType = 'commission'

        return {
          id: String(tx.id), 
          type: uiType, 
          label: tx.label || getLabel(tx), 
          amount: String(tx.amount),
          note: tx.note || '',
          status: (tx.status === 'completed' || tx.status === 'success')? 'success' : tx.status, 
          createdAt: tx.createdAt, 
          phone: tx.phone || phone, 
          method: tx.method || '', 
          withdrawPhone: tx.withdrawPhone || '',
          withdrawName: tx.withdrawName || '', 
          bookTitle: tx.bookTitle || '',
          vipLevel: tx.vipLevel || ''
        };
      })
     .filter(Boolean)
     .filter((v, i, a) => a.findIndex(t => t.id === v.id) === i)
     .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))

    return NextResponse.json({ 
      success: true, 
      availableBalance, 
      transactions 
    }, { headers: { 'Cache-Control': 'no-store' } })
    
  } catch (err) {
    console.error('GET /api/transactions 500:', err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}