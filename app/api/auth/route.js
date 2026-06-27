export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()

function safeParse(str, fallback = []) {
  if (!str) return fallback
  try {
    return JSON.parse(str)
  } catch {
    return fallback
  }
}

function safeNumber(val, fallback = 0) {
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

export async function POST(req) {
  try {
    let body
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    
    const { action } = body || {}

    if (action === 'register') {
      const { username, phone, password } = body

      if (typeof username !== 'string' || !/^[a-zA-Z0-9]{6}$/.test(username)) {
        return NextResponse.json({ error: 'Username must be 6 alphanumeric chars' }, { status: 400 })
      }
      if (typeof phone !== 'string' || !/^07\d{8}$/.test(phone)) {
        return NextResponse.json({ error: 'Phone must be 07XXXXXXXX' }, { status: 400 })
      }
      if (typeof password !== 'string' || !/^[a-zA-Z0-9]{6}$/.test(password)) {
        return NextResponse.json({ error: 'Password must be 6 alphanumeric chars' }, { status: 400 })
      }

      const userKey = `user:${phone}`
      const exists = await redis.hgetall(userKey).catch(() => null)
      
      // FIX: Upstash can return [] or {} for missing. Only count it if phone field exists
      const alreadyExists = exists && !Array.isArray(exists) && Object.keys(exists).length > 0 && exists.phone
      if (alreadyExists) {
        return NextResponse.json({ error: 'Phone already registered' }, { status: 400 })
      }

      const userInviteCode = `PM${phone.slice(-6)}`

      await redis.hset(userKey, {
        username,
        phone,
        password, // In prod: hash this with bcrypt
        inviteCode: userInviteCode,
        availableBalance: 2500,
        unlockedBooks: '[]',
        completedBooks: '[]',
        vip: 0,
        books_read_today: 0,
        dailyIncome: 0,
        lastResetDate: '',
        createdAt: Date.now()
      })

      return NextResponse.json({ success: true, inviteCode: userInviteCode })
    }

    if (action === 'login') {
      const { phone, password } = body

      if (!phone || !/^07\d{8}$/.test(phone)) {
        return NextResponse.json({ error: 'Invalid phone' }, { status: 400 })
      }
      if (!password || typeof password !== 'string') {
        return NextResponse.json({ error: 'Invalid password' }, { status: 400 })
      }

      const userKey = `user:${phone}`
      const user = await redis.hgetall(userKey).catch(() => null)
      
      console.log("LOGIN DEBUG:", { 
        sent_phone: phone, 
        userKey, 
        redis_result: user, 
        isArray: Array.isArray(user),
        keys: user && !Array.isArray(user) ? Object.keys(user) : null
      })

      // FIX: Upstash returns null, {} OR [] for missing/empty. All = not found
      const notFound = !user || Array.isArray(user) || Object.keys(user).length === 0 || !user.phone
      if (notFound) {
        return NextResponse.json({ error: 'User not found', debug_user: user }, { status: 404 })
      }

      if (String(user.password || '') !== String(password)) {
        return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
      }

      // FIX: Clone the frozen object before mutating. This kills the 500 "object is not extensible"
      const safeUser = { ...user }

      // Migrate old 'balance' -> 'availableBalance' safely
      const oldBalance = safeNumber(safeUser.balance)
      const currentBalance = safeNumber(safeUser.availableBalance)
      
      if (oldBalance > 0 && currentBalance === 0) {
        await redis.hset(userKey, { 
          availableBalance: oldBalance,
          balance: 0
        })
        safeUser.availableBalance = oldBalance
      } else {
        safeUser.availableBalance = currentBalance
      }

      // SAFE PARSE: Never crash if Redis data is corrupted
      safeUser.unlockedBooks = safeParse(safeUser.unlockedBooks)
      safeUser.completedBooks = safeParse(safeUser.completedBooks)
      safeUser.vip = safeNumber(safeUser.vip)
      safeUser.books_read_today = safeNumber(safeUser.books_read_today)
      safeUser.dailyIncome = safeNumber(safeUser.dailyIncome)

      // FIX: Delete from clone only
      delete safeUser.password
      delete safeUser.balance

      return NextResponse.json({ success: true, user: safeUser })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error("Auth route error:", err)
    return NextResponse.json({ 
      error: 'Server error', 
      detail: process.env.NODE_ENV === 'development' ? err.message : undefined 
    }, { status: 500 })
  }
}