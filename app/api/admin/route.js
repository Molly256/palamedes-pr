export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()
const parse = s => typeof s === 'object' ? s : JSON.parse(s || 'null')

const dateKey = (p, d = 0) => { 
  const x = new Date()
  x.setUTCDate(x.getUTCDate() - d)
  return `tx:${p}:${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, '0')}-${String(x.getUTCDate()).padStart(2, '0')}` 
}

export async function GET(req) {
  try {
    const a = req.nextUrl.searchParams.get('action'), ph = req.nextUrl.searchParams.get('phone')

    if (a === 'pending') {
      const keys = ph ? [dateKey(ph, 0), dateKey(ph, 1)] : await redis.smembers('admin:pending_txs') || []
      let list = []

      if (keys.length > 0) {
        const allLists = await Promise.all(keys.map(k => redis.lrange(k, 0, 199))), deadKeys = []

        keys.forEach((k, idx) => {
          const parts = String(k || '').split(':'), phKey = ph || parts[1] || '', items = allLists[idx] || []
          const filtered = items.map(parse).filter(t => t?.status === 'pending').map(t => ({ ...t, phone: t.phone || phKey }))
          if (!ph && filtered.length === 0) deadKeys.push(k)
          else list.push(...filtered)
        })
        if (deadKeys.length > 0) await redis.srem('admin:pending_txs', ...deadKeys)
      }
      return NextResponse.json({ success: true, pending: list })
    }

    if (a === 'user') {
      if (!ph) return NextResponse.json({ success: false, error: 'Phone required' }, { status: 400 })
      const u = await redis.hgetall(`user:${ph}`)
      if (!u || !u.phone) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      
      try { u.unlockedBooks = JSON.parse(u.unlockedBooks || '[]') } catch { u.unlockedBooks = [] }
      try { u.completedBooks = JSON.parse(u.completedBooks || '[]') } catch { u.completedBooks = [] }
      u.availableBalance = +u.availableBalance || 0; u.vip = +u.vip || 0
      return NextResponse.json({ success: true, user: u })
    }
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }) }
}

export async function POST(req) {
  try {
    const { action, id, status, password, phone: ph } = await req.json()

    if (action === 'updateStatus') {
      let key = await redis.hget('tx:lookup', id), p = ph

      if (!key && p) {
        const uKeys = [dateKey(p, 0), dateKey(p, 1)], res = await Promise.all(uKeys.map(k => redis.lrange(k, 0, 199)))
        for (let i = 0; i < 2; i++) { if ((res[i] || []).findIndex(x => parse(x)?.id === id) > -1) { key = uKeys[i]; break; } }
      }
      if (!key) {
        const activeKeys = await redis.smembers('admin:pending_txs') || [], res = await Promise.all(activeKeys.map(k => redis.lrange(k, 0, 199)))
        for (let i = 0; i < activeKeys.length; i++) { if ((res[i] || []).findIndex(x => parse(x)?.id === id) > -1) { key = activeKeys[i]; break; } }
      }

      if (!key) return NextResponse.json({ success: false, error: `Transaction not found: ${id}` }, { status: 404 })

      const items = await redis.lrange(key, 0, 199) || [], originalItemString = items.find(x => parse(x)?.id === id)
      if (!originalItemString) return NextResponse.json({ success: false, error: 'Transaction missing' }, { status: 404 })
      
      const tx = parse(originalItemString)
      
      // FIXED: Always fallback to the phone number embedded inside the transaction object itself
      if (!p) p = tx.phone || key.split(':')[1] || ''
      if (!p) return NextResponse.json({ success: false, error: 'Could not resolve user phone number' }, { status: 400 })
      if (tx.status !== 'pending') return NextResponse.json({ success: false, error: 'Transaction already processed' }, { status: 400 })

      const updatedTx = { ...tx, status, updatedAt: String(Date.now()) }, updatedTxString = JSON.stringify(updatedTx)
      
      // FIXED: Removed Promise.all here. We must remove the old item BEFORE pushing the new one to prevent list bugs.
      await redis.lrem(key, 1, originalItemString)
      await redis.lpush(key, updatedTxString)

      const hKey = `tx:${p}:history`, hItems = await redis.lrange(hKey, 0, 399) || [], oldHistoryString = hItems.find(x => parse(x)?.id === id)
      if (oldHistoryString) {
        await redis.lrem(hKey, 1, oldHistoryString)
        await redis.lpush(hKey, updatedTxString)
      }

      if (!items.map(x => parse(x)?.id === id ? updatedTx : parse(x)).some(t => t?.status === 'pending')) {
        await redis.srem('admin:pending_txs', key)
      }

      const amt = +String(tx.amount || 0).replace(/,/g, '')
      if (status === 'success' && tx.type === 'deposit') await redis.hincrbyfloat(`user:${p}`, 'availableBalance', amt)
      if (status === 'failed' && tx.type === 'withdraw') await redis.hincrbyfloat(`user:${p}`, 'availableBalance', Math.round(amt / 0.9))

      return NextResponse.json({ success: true })
    }

    if (action === 'resetPassword') {
      if (!ph || !password) return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 })
      if (!await redis.hexists(`user:${ph}`, 'phone')) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      await redis.hset(`user:${ph}`, { password })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }) }
}