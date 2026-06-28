import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()
const ADMIN_PHONE = '0753520252'

async function isAdmin(phone) {
  return phone === ADMIN_PHONE
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
      
      for (const id of pendingIds) {
        const tx = await redis.hgetall(`tx:${id}`)
        if (tx && Object.keys(tx).length > 0 && tx.status === 'pending') {
          pending.push(tx)
        }
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
      if (!id || !status) {
        return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 })
      }
      
      const tx = await redis.hgetall(`tx:${id}`)
      if (!tx || Object.keys(tx).length === 0) {
        return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 })
      }
      
      const userPhone = tx.phone
      const updatedAt = String(Date.now())

      // 1. Update admin hash copy + remove from pending queue
      await redis.hset(`tx:${id}`, { status, updatedAt })
      await redis.lrem('pending_tx', 0, id)
      
      // 2. FIX: Update the JSON inside user's tx:phone list too
      // This makes the user see 'Success' green instead of 'Pending' grey
      const listKey = `tx:${userPhone}`
      const items = await redis.lrange(listKey, 0, 199)
      const idx = items.findIndex(s => { try { return JSON.parse(s).id === id } catch { return false } })

      if (idx !== -1) {
        const txObj = JSON.parse(items[idx])
        txObj.status = status
        txObj.updatedAt = updatedAt
        await redis.lset(listKey, idx, JSON.stringify(txObj))
      }

      // 3. Credit balance if deposit approved
      if (status === 'success' && tx.type === 'deposit') {
        const userKey = `user:${userPhone}`
        const user = await redis.hgetall(userKey)
        const amount = Number(tx.amount || 0)
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
      if (!phone || !password) {
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