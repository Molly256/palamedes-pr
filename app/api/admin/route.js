export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()

const safeParse = (s) => { 
  if (typeof s === 'object') return s
  try { return JSON.parse(s) } catch { return null } 
}

const getDateKey = (phone, offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `tx:${phone}:${yyyy}-${mm}-${dd}`
}

// GET: /api/admin?action=pending&phone=0753...
export async function GET(req) {
  try {
    const action = req.nextUrl.searchParams.get('action')
    const phone = req.nextUrl.searchParams.get('phone')

    if (action === 'pending') {
      if (!phone) return NextResponse.json({ success: false, error: 'Phone required' }, { status: 400 })
      
      // Check today + yesterday only. No keys() scan.
      let allItems = []
      for (let i = 0; i < 2; i++) {
        const key = getDateKey(phone, i)
        const items = await redis.lrange(key, 0, 199)
        allItems.push(...items)
      }

      const pending = allItems
        .map(raw => safeParse(raw))
        .filter(tx => tx && tx.status === 'pending')
      
      return NextResponse.json({ success: true, pending })
    }

    if (action === 'user') {
      if (!phone) return NextResponse.json({ success: false, error: 'Phone required' }, { status: 400 })
      const user = await redis.hgetall(`user:${phone}`)
      if (!user || !Object.keys(user).length) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      
      try { user.unlockedBooks = JSON.parse(user.unlockedBooks || '[]'); user.completedBooks = JSON.parse(user.completedBooks || '[]') } catch { user.unlockedBooks = []; user.completedBooks = [] }
      user.availableBalance = Number(user.availableBalance || 0)
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
      if (!id || !status || !phone) return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 })

      // Find tx in today or yesterday only
      let txObj = null, keyFound = null, idx = -1
      for (let i = 0; i < 2; i++) {
        const key = getDateKey(phone, i)
        const items = await redis.lrange(key, 0, 199)
        idx = items.findIndex(it => safeParse(it)?.id === id)
        if (idx !== -1) {
          keyFound = key
          txObj = safeParse(items[idx])
          break
        }
      }

      if (!txObj) return NextResponse.json({ success: false, error: `Transaction not found: ${id}` }, { status: 404 })
      if (txObj.status === 'success' || txObj.status === 'failed') {
        return NextResponse.json({ success: false, error: 'Transaction already processed' }, { status: 400 })
      }

      txObj.status = status
      txObj.updatedAt = String(Date.now())
      await redis.lset(keyFound, idx, JSON.stringify(txObj))

      if (status === 'success') {
        const amount = Number(String(txObj.amount || 0).replace(/,/g, ''))

        if (txObj.type === 'deposit') {
          await redis.hincrby(`user:${phone}`, 'availableBalance', amount)
        } else if (txObj.type === 'withdraw') {
          const user = await redis.hgetall(`user:${phone}`) || {}
          const avail = Number(user.availableBalance || 0)
          if (avail < amount) {
            return NextResponse.json({ success: false, error: 'Insufficient availableBalance' }, { status: 400 })
          }
          await redis.hincrby(`user:${phone}`, 'availableBalance', -amount)
        }
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'resetPassword') {
      if (!phone || !password) return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 })
      const user = await redis.hgetall(`user:${phone}`)
      if (!user || !Object.keys(user).length) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      await redis.hset(`user:${phone}`, { password })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }) }
}