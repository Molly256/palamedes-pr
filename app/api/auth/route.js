export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import crypto from 'crypto' // 👈 FIXED: Explicitly import crypto to prevent phone runtime crashes

const redis = Redis.fromEnv()

const toNum = (v, f = 0) => {
  const n = Number(v)
  return Number.isNaN(n) ? f : n
}

export async function POST(req) {
  try {
    const { action, username, phone, password, referrerCode } = await req.json()
    
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
      const exists = await redis.hget(userKey, 'phone')
      
      if (exists) {
        return NextResponse.json({ error: 'Phone already registered' }, { status: 400 })
      }

      const inviteCode = `PM${phone.slice(-6)}`
      const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
      const pipeline = redis.pipeline()

      let directInviterPhone = null

      if (referrerCode && /^PM\d{6}$/.test(referrerCode)) {
        directInviterPhone = await redis.get(`invite_code_map:${referrerCode}`)
        
        if (directInviterPhone && directInviterPhone !== phone) {
          pipeline.hset(`downlines:${directInviterPhone}`, phone, '1')

          const grandparentPhone = await redis.hget(`user:${directInviterPhone}`, 'invited_by')
          if (grandparentPhone) {
            pipeline.hset(`downlines:${grandparentPhone}`, phone, '2')

            const greatGrandparentPhone = await redis.hget(`user:${grandparentPhone}`, 'invited_by')
            if (greatGrandparentPhone) {
              pipeline.hset(`downlines:${greatGrandparentPhone}`, phone, '3')
            }
          }
        }
      }

      const userProfile = {
        username,
        phone,
        password,
        inviteCode,
        availableBalance: '2500',
        vip: '0',
        books_read_today: '0',
        dailyIncome: '0',
        completedBooks: '[]',
        unlockedBooks: '[]',
        lastResetDate: date,
        createdAt: String(Date.now())
      }

      if (directInviterPhone && directInviterPhone !== phone) {
        userProfile.invited_by = String(directInviterPhone)
      }

      pipeline.hset(userKey, userProfile)
      pipeline.set(`invite_code_map:${inviteCode}`, phone)

      pipeline.lpush(`tx:${phone}:${date}`, JSON.stringify({
        id: crypto.randomUUID(), // Now calls safely from imported module context
        type: 'system_increase',
        amount: '2500',
        note: 'Registration Reward',
        status: 'completed',
        createdAt: String(Date.now())
      }));

      await pipeline.exec()

      return NextResponse.json({ success: true, inviteCode })
    }

    if (action === 'login') {
      if (!/^07\d{8}$/.test(phone) || !password) {
        return NextResponse.json({ error: 'Invalid phone or password' }, { status: 400 })
      }

      const userKey = `user:${phone}`
      const user = await redis.hgetall(userKey)

      if (!user?.phone) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (String(user.password) !== String(password)) {
        return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
      }

      if (toNum(user.balance) > 0 && toNum(user.availableBalance) === 0) {
        await redis.hset(userKey, { 
          availableBalance: user.balance
        })
        user.availableBalance = user.balance
      }

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