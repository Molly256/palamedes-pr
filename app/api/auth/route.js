export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()

const toNum = (v, f = 0) => {
  const n = Number(v)
  return Number.isNaN(n) ? f : n
}

export async function POST(req) {
  try {
    const { action, username, phone, password } = await req.json()
    
    if (action === 'register') {
      if (!/^[a-zA-Z0-9]{6}$/.test(username)) {
        return NextResponse.json({ error: 'Username must be 6 alphanumeric chars' }, { status: 400 })
      }
      if (!/^07\d{8}$/.test(phone)) {
        return NextResponse.json({ error: 'Phone must be 07XXXXXXXX' }, { status: 400 })
      }
      if (!/^[a-zA-Z0-9]{6}$/.test(password)) {
        return NextResponse.json({ error: 'Password must be 6 alphanumeric chars' }, { status: 400 })
      }

      const userKey = `user:${phone}`
      const exists = await redis.hget(userKey, 'phone') // <- 1 call only. No lag.
      
      if (exists) {
        return NextResponse.json({ error: 'Phone already registered' }, { status: 400 })
      }

      const inviteCode = `PM${phone.slice(-6)}`

      // All strings for Upstash
      await redis.hset(userKey, {
        username,
        phone,
        password,
        inviteCode,
        availableBalance: '2500',
        vip: '0',
        books_read_today: '0',
        dailyIncome: '0',
        lastResetDate: '',
        createdAt: String(Date.now())
      })

      return NextResponse.json({ success: true, inviteCode })
    }

    if (action === 'login') {
      if (!/^07\d{8}$/.test(phone) || !password) {
        return NextResponse.json({ error: 'Invalid phone or password' }, { status: 400 })
      }

      const userKey = `user:${phone}`
      const user = await redis.hgetall(userKey) // <- 1 call only

      if (!user?.phone) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (String(user.password) !== String(password)) {
        return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
      }

      // Migrate old balance -> availableBalance once
      if (toNum(user.balance) > 0 && toNum(user.availableBalance) === 0) {
        await redis.hset(userKey, { 
          availableBalance: user.balance,
          balance: '0'
        })
        user.availableBalance = user.balance
      }

      // Send numbers to frontend, remove secrets
      const safeUser = {
        username: user.username,
        phone: user.phone,
        inviteCode: user.inviteCode,
        vip: toNum(user.vip),
        availableBalance: toNum(user.availableBalance),
        books_read_today: toNum(user.books_read_today),
        dailyIncome: toNum(user.dailyIncome),
        createdAt: user.createdAt
      }

      return NextResponse.json({ success: true, user: safeUser })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error("Auth error:", err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}