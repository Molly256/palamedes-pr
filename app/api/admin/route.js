export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()
const ADMIN_PHONE = '0753520252'

const safeParse = (s) => { if (typeof s === 'object') return s; try { return JSON.parse(s) } catch { return null } }

// GET: /api/admin?action=pending
export async function GET(req) {
  try {
    const action = req.nextUrl.searchParams.get('action')
    const phone = req.nextUrl.searchParams.get('phone')

    if (action === 'pending') {
      const pendingIds = await redis.lrange('pending_tx', 0, 999)
      const pending = []
      for (const id of pendingIds) {
        let foundTx = null
        const keys = await redis.keys('tx:07*') // only lists now
        for (const k of keys) {
          const items = await redis.lrange(k, 0, 199)
          const hit = items.map(safeParse).find(t => t?.id === id && t?.status === 'pending')
          if(hit) { foundTx = hit; break }
        }
        if (foundTx) pending.push(foundTx)
      }
      return NextResponse.json({ success: true, pending })
    }

    if (action === 'user') {
      if (!phone) return NextResponse.json({ success: false, error: 'Phone required' }, { status: 400 })
      const user = await redis.hgetall(`user:${phone}`)
      if (!user || !Object.keys(user).length) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      try { user.unlockedBooks = JSON.parse(user.unlockedBooks || '[]'); user.completedBooks = JSON.parse(user.completedBooks || '[]') } catch { user.unlockedBooks = []; user.completedBooks = [] }
      user.availableBalance = Number(user.availableBalance || user.balance || 0); user.balance = Number(user.balance || 0); user.vip = Number(user.vip || 0)
      return NextResponse.json({ success: true, user })
    }
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err) { console.error('GET /api/admin error:', err); return NextResponse.json({ success: false, error: err.message }, { status: 500 }) }
}

// POST: updateStatus, resetPassword
export async function POST(req) {
  try {
    const { action, id, status, password } = await req.json()

    if (action === 'updateStatus') {
      if (!id ||!status) return NextResponse.json({ success: false, error: 'Missing data: id, status' }, { status: 400 })

      // Find in tx:phone lists only
      let userPhone = null; let txObj = null; let idx = -1
      const keys = await redis.keys('tx:07*')
      for (const k of keys) {
        const items = await redis.lrange(k, 0, 199)
        idx = items.findIndex(s => { try { return JSON.parse(s).id === id } catch { return false } })
        if (idx!== -1) { userPhone = k.replace('tx:', ''); txObj = JSON.parse(items[idx]); break }
      }

      if (!txObj || idx === -1) return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })

      txObj.status = status; txObj.updatedAt = String(Date.now())
      await redis.lset(`tx:${userPhone}`, idx, JSON.stringify(txObj))
      await redis.lrem('pending_tx', 0, id)

      if (status === 'success' && txObj.type === 'deposit') {
        const userKey = `user:${userPhone}`
        const user = await redis.hgetall(userKey)
        const amount = Number(txObj.amount || 0)
        await redis.hset(userKey, { balance: Number(user.balance || 0) + amount, availableBalance: Number(user.availableBalance || user.balance || 0) + amount })
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'resetPassword') {
      if (!phone ||!password) return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 })
      const user = await redis.hgetall(`user:${phone}`)
      if (!user || !Object.keys(user).length) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      await redis.hset(`user:${phone}`, { password })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err) { console.error('POST /api/admin error:', err); return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 }) }
}