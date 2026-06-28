export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()

// GET: /api/admin?action=pending
export async function GET(req) {
  try {
    const action = req.nextUrl.searchParams.get('action')
    const phone = req.nextUrl.searchParams.get('phone')

    if (action === 'pending') {
      const pendingIds = await redis.lrange('pending_tx', 0, 999)
      if (pendingIds.length === 0) return NextResponse.json({ success: true, pending: [] })

      const pending = []
      const txKeys = await redis.keys('tx:*') // gets all tx:phone
      
      for (const key of txKeys) {
        const items = await redis.lrange(key, 0, 199)
        for (const raw of items) {
          try {
            const tx = JSON.parse(raw)
            if (pendingIds.includes(tx.id) && tx.status === 'pending') {
              pending.push(tx)
            }
          } catch {}
        }
      }
      return NextResponse.json({ success: true, pending })
    }

    if (action === 'user') {
      if (!phone) return NextResponse.json({ success: false, error: 'Phone required' }, { status: 400 })
      const user = await redis.hgetall(`user:${phone}`)
      if (!user || !Object.keys(user).length) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      
      try { user.unlockedBooks = JSON.parse(user.unlockedBooks || '[]'); user.completedBooks = JSON.parse(user.completedBooks || '[]') } catch { user.unlockedBooks = []; user.completedBooks = [] }
      user.availableBalance = Number(user.availableBalance || user.balance || 0)
      user.balance = Number(user.balance || 0)
      user.vip = Number(user.vip || 0)
      return NextResponse.json({ success: true, user })
    }
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }) }
}

// POST: updateStatus, resetPassword
export async function POST(req) {
  try {
    const { action, id, status, password, phone } = await req.json()

    if (action === 'updateStatus') {
      if (!id ||!status) return NextResponse.json({ success: false, error: 'Missing data: id, status' }, { status: 400 })

      let userPhone = null; let idx = -1; let txObj = null
      const txKeys = await redis.keys('tx:*')

      for (const key of txKeys) {
        const items = await redis.lrange(key, 0, 199)
        for (let i = 0; i < items.length; i++) {
          try {
            const tx = JSON.parse(items[i])
            if (tx.id === id) {
              userPhone = key.replace('tx:', '')
              idx = i
              txObj = tx
              break
            }
          } catch {}
        }
        if (idx!== -1) break
      }

      if (!txObj) return NextResponse.json({ success: false, error: `Transaction not found: ${id}` }, { status: 404 })

      txObj.status = status
      txObj.updatedAt = String(Date.now())
      await redis.lset(`tx:${userPhone}`, idx, JSON.stringify(txObj))
      await redis.lrem('pending_tx', 0, id)

      if (status === 'success' && txObj.type === 'deposit') {
        const user = await redis.hgetall(`user:${userPhone}`)
        const amount = Number(txObj.amount || 0)
        await redis.hset(`user:${userPhone}`, { 
          balance: Number(user.balance || 0) + amount, 
          availableBalance: Number(user.availableBalance || user.balance || 0) + amount 
        })
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
  } catch (err) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }) }
}