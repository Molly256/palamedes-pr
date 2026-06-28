export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()
const ADMIN_PHONE = '0753520252'

const safeParse = (s) => {
  if (typeof s === 'object') return s
  try { return JSON.parse(s) } catch { return null }
}

// GET: /api/admin?action=pending
// GET: /api/admin?action=user&phone=07XXXXXXXX
export async function GET(req) {
  try {
    const action = req.nextUrl.searchParams.get('action')
    const phone = req.nextUrl.searchParams.get('phone')

    if (action === 'pending') {
      const pendingIds = await redis.lrange('pending_tx', 0, 999)
      const pending = []

      // NEW: Find TX by scanning tx:phone lists, not tx:id hash
      for (const id of pendingIds) {
        let foundTx = null
        // Scan all user tx lists. Note: KEYS is O(N). OK for <10k users.
        const keys = await redis.keys('tx:07*')
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
      if (!phone) {
        return NextResponse.json({ success: false, error: 'Phone required' }, { status: 400 })
      }

      const user = await redis.hgetall(`user:${phone}`)
      if (!user || Object.keys(user).length === 0) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      }

      try {
        user.unlockedBooks = JSON.parse(user.unlockedBooks || '[]')
        user.completedBooks = JSON.parse(user.completedBooks || '[]')
      } catch {
        user.unlockedBooks = []
        user.completedBooks = []
      }

      user.availableBalance = Number(user.availableBalance || user.balance || 0)
      user.balance = Number(user.balance || 0)
      user.vip = Number(user.vip || 0)

      return NextResponse.json({ success: true, user })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('GET /api/admin error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

// POST: updateStatus, resetPassword
export async function POST(req) {
  try {
    const body = await req.json()
    const { action, id, status, phone, password } = body

    if (action === 'updateStatus') {
      if (!id ||!status ||!phone) { // phone is now required from admin UI
        return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 })
      }

      // 1. SOURCE OF TRUTH: Update only tx:phone list
      const listKey = `tx:${phone}`
      const items = await redis.lrange(listKey, 0, 199)
      const idx = items.findIndex(s => { try { return JSON.parse(s).id === id } catch { return false } })
      if (idx === -1) {
        return NextResponse.json({ success: false, error: 'Transaction not found in user list' }, { status: 404 })
      }

      const txObj = JSON.parse(items[idx])
      txObj.status = status
      txObj.updatedAt = String(Date.now())
      await redis.lset(listKey, idx, JSON.stringify(txObj))

      await redis.lrem('pending_tx', 0, id) // Remove from admin queue

      // 2. Credit balance if deposit approved
      if (status === 'success' && txObj.type === 'deposit') {
        const userKey = `user:${phone}`
        const user = await redis.hgetall(userKey)
        const amount = Number(txObj.amount || 0)
        const currentBalance = Number(user.balance || 0)
        const currentAvail = Number(user.availableBalance || currentBalance)
        await redis.hset(userKey, {
          balance: currentBalance + amount,
          availableBalance: currentAvail + amount
        })
      }

      return NextResponse.json({ success: true })
    }

    if (action === 'resetPassword') {
      if (!phone ||!password) {
        return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 })
      }

      const user = await redis.hgetall(`user:${phone}`)
      if (!user || Object.keys(user).length === 0) {
        return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      }

      await redis.hset(`user:${phone}`, { password })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/admin error:', err)
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 })
  }
}