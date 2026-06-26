export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()

function safeParse(str, fallback = []) {
  try {
    return JSON.parse(str || '[]')
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
    // 1. SAFE JSON PARSE: prevent "Unexpected non-whitespace character" crash
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
      const exists = await redis.hgetall(userKey)
      if (exists && Object.keys(exists).length > 0) {
        return NextResponse.json({ error: 'Phone already registered' }, { status: 400 })
      }

      const userInviteCode = `PM${phone.slice(-6)}`

      await redis.hset(userKey, {
        username,
        phone,
        password, // In prod: hash this
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

      if (typeof phone !== 'string' || !/^07\d{8}$/.test(phone)) {
        return NextResponse.json({ error: 'Invalid phone' }, { status: 400 })
      }
      if (typeof password !== 'string') {
        return NextResponse.json({ error: 'Invalid password' }, { status: 400 })
      }

      const userKey = `user:${phone}`
      const user = await redis.hgetall(userKey)
      if (!user || Object.keys(user).length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      // Password check
      if (String(user.password) !== String(password)) {
        return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
      }

      // Migrate old 'balance' -> 'availableBalance' safely
      const oldBalance = safeNumber(user.balance)
      const currentBalance = safeNumber(user.availableBalance)
      
      if (oldBalance > 0 && currentBalance === 0) {
        await redis.hset(userKey, { 
          availableBalance: oldBalance,
          balance: 0
        })
        user.availableBalance = oldBalance
      } else {
        user.availableBalance = currentBalance
      }

      // SAFE PARSE: Never crash if Redis data is corrupted
      user.unlockedBooks = safeParse(user.unlockedBooks)
      user.completedBooks = safeParse(user.completedBooks)
      user.vip = safeNumber(user.vip)
      user.books_read_today = safeNumber(user.books_read_today)
      user.dailyIncome = safeNumber(user.dailyIncome)

      // Remove sensitive fields
      delete user.password
      delete user.balance

      return NextResponse.json({ success: true, user })
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