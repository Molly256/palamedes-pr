export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()

const safeParse = (s) => { 
  if (typeof s === 'object') return s
  try { return JSON.parse(s) } catch { return null } 
}

// Generates the pattern with the full 4-digit year (e.g., 2026)
const getDateKey = (phone, offsetDays = 0) => {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  const yyyy = d.getFullYear() // This extracts the full year (e.g., 2026)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `tx:${phone}:${yyyy}-${mm}-${dd}`
}

// GET: /api/admin?action=pending
export async function GET(req) {
  try {
    const action = req.nextUrl.searchParams.get('action')
    const phone = req.nextUrl.searchParams.get('phone')

    if (action === 'pending') {
      let pending = []

      // If a specific phone is provided, run the fast optimized lookup
      if (phone) {
        let allItems = []
        for (let i = 0; i < 2; i++) {
          const key = getDateKey(phone, i)
          const items = await redis.lrange(key, 0, 199)
          allItems.push(...items)
        }
        pending = allItems
          .map(raw => safeParse(raw))
          .filter(tx => tx && tx.status === 'pending')
          .map(tx => ({ ...tx, phone })) // Ensure phone is explicitly attached
      } 
      // If no phone is provided, find ALL pending transactions across the database
      else {
        // Generates wildcard keys for today and yesterday: tx:*:2026-mm-dd
        const todayPattern = getDateKey('*', 0)
        const yesterdayPattern = getDateKey('*', 1)

        // Scan the Redis database for matching keys
        const todayKeys = await redis.keys(todayPattern) || []
        const yesterdayKeys = await redis.keys(yesterdayPattern) || []
        const allKeys = [...todayKeys, ...yesterdayKeys]

        // Fetch items from all discovered transaction lists
        for (const key of allKeys) {
          // Extract the phone number safely from the key structure: tx:PHONE:yyyy-mm-dd
          const keyParts = key.split(':')
          const extractedPhone = keyParts[1] || ''

          const items = await redis.lrange(key, 0, 199)
          const filtered = items
            .map(raw => safeParse(raw))
            .filter(tx => tx && tx.status === 'pending')
            // Inject the phone parameter into the transaction object before sending it to frontend
            .map(tx => ({ ...tx, phone: tx.phone || extractedPhone })) 
            
          pending.push(...filtered)
        }
      }
      
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
    const { action, id, status, password, phone: inputPhone } = await req.json()

    if (action === 'updateStatus') {
      // Input phone validation removed here since the backend will automatically scan keys if it is missing
      if (!id || !status) return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 })

      let txObj = null, keyFound = null, idx = -1, finalPhone = inputPhone

      // Scenario A: If the frontend provided a phone number property, test that optimized key direct lookup path first
      if (finalPhone) {
        for (let i = 0; i < 2; i++) {
          const key = getDateKey(finalPhone, i)
          const items = await redis.lrange(key, 0, 199)
          idx = items.findIndex(it => safeParse(it)?.id === id)
          if (idx !== -1) {
            keyFound = key
            txObj = safeParse(items[idx])
            break
          }
        }
      }

      // Scenario B: If transaction isn't found yet (or phone wasn't passed), fallback to a database keys wildcard scan lookup
      if (!txObj) {
        const todayKeys = await redis.keys(getDateKey('*', 0)) || []
        const yesterdayKeys = await redis.keys(getDateKey('*', 1)) || []
        const allKeys = [...todayKeys, ...yesterdayKeys]

        for (const key of allKeys) {
          const items = await redis.lrange(key, 0, 199)
          idx = items.findIndex(it => safeParse(it)?.id === id)
          if (idx !== -1) {
            keyFound = key
            txObj = safeParse(items[idx])
            const keyParts = key.split(':')
            finalPhone = keyParts[1] // Safely parse out user phone straight from the key name context
            break
          }
        }
      }

      if (!txObj || !finalPhone) return NextResponse.json({ success: false, error: `Transaction not found: ${id}` }, { status: 404 })
      if (txObj.status === 'success' || txObj.status === 'failed') {
        return NextResponse.json({ success: false, error: 'Transaction already processed' }, { status: 400 })
      }

      txObj.status = status
      txObj.updatedAt = String(Date.now())
      await redis.lset(keyFound, idx, JSON.stringify(txObj))

      if (status === 'success') {
        const amount = Number(String(txObj.amount || 0).replace(/,/g, ''))

        if (txObj.type === 'deposit') {
          await redis.hincrby(`user:${finalPhone}`, 'availableBalance', amount)
        } else if (txObj.type === 'withdraw') {
          const user = await redis.hgetall(`user:${finalPhone}`) || {}
          const avail = Number(user.availableBalance || 0)
          if (avail < amount) {
            return NextResponse.json({ success: false, error: 'Insufficient availableBalance' }, { status: 400 })
          }
          await redis.hincrby(`user:${finalPhone}`, 'availableBalance', -amount)
        }
      }
      return NextResponse.json({ success: true })
    }

    if (action === 'resetPassword') {
      if (!inputPhone || !password) return NextResponse.json({ success: false, error: 'Missing data' }, { status: 400 })
      const user = await redis.hgetall(`user:${inputPhone}`)
      if (!user || !Object.keys(user).length) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
      await redis.hset(`user:${inputPhone}`, { password })
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  } catch (err) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }) }
}