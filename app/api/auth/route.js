export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const redis = Redis.fromEnv()

const toNum = (v, f = 0) => {
  if (v === undefined || v === null) return f
  const n = Number(v)
  return Number.isNaN(n) ? f : n
}

// FIXED: Outputs full 4-digit year format (e.g., 2026-07-02) to match your VIP levels file perfectly
const getUgandanFullDate = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

// Outputs full time structure (e.g., 2026-07-02 14:32)
const getUgandanDateTimeString = () => {
  return new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).slice(0,16).replace(',', ' ')
}

export async function POST(req) {
  try {
    const { action, username, phone, password, inviterCode } = await req.json() 
    const referrerCode = inviterCode 
    
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
      const date = getUgandanFullDate() // <- FIXED: Using YYYY-MM-DD
      const timeStr = getUgandanDateTimeString()
      const pipeline = redis.pipeline()

      let directInviterPhone = null

      // --- ASYNCHRONOUS CHAIN RESOLUTION BEFORE PIPELINE WRITING ---
      if (referrerCode && /^PM\d{6}$/.test(referrerCode)) {
        // Find Direct Inviter (Team A) Phone via code map
        directInviterPhone = await redis.get(`invite_code_map:${referrerCode}`) 
        
        if (directInviterPhone && directInviterPhone !== phone) {
          // Track to Direct Inviter's Team A Row
          pipeline.hset(`downlines:${directInviterPhone}`, phone, '1') 

          // Find Grandparent (Team B) Phone
          const grandparentPhone = await redis.hget(`user:${directInviterPhone}`, 'invited_by')
          if (grandparentPhone && grandparentPhone !== phone) {
            pipeline.hset(`downlines:${grandparentPhone}`, phone, '2') 

            // Find Great Grandparent (Team C) Phone
            const greatGrandparentPhone = await redis.hget(`user:${grandparentPhone}`, 'invited_by')
            if (greatGrandparentPhone && greatGrandparentPhone !== phone) {
              pipeline.hset(`downlines:${greatGrandparentPhone}`, phone, '3') 
            }
          }
        }
      }

      const userProfile = {
        username: String(username),
        phone: String(phone),
        password: String(password),
        inviteCode: String(inviteCode), 
        availableBalance: '2500',
        vip: '0',
        books_read_today: '0',
        dailyIncome: '0',
        completedBooks: '[]',
        unlockedBooks: '[]',
        lastResetDate: String(date),
        createdAt: String(date) 
      }

      // Explicitly tie tracking to profile object schema
      if (directInviterPhone && directInviterPhone !== phone) {
        userProfile.invited_by = String(directInviterPhone) 
      } else {
        userProfile.invited_by = ''
      }

      pipeline.hset(userKey, userProfile)
      pipeline.set(`invite_code_map:${inviteCode}`, phone) 

      // FIXED: Writes to your 4-digit date key format consistently
      pipeline.lpush(`tx:${phone}:${date}`, JSON.stringify({
        id: crypto.randomUUID(),
        type: 'system_increase',
        amount: '2500',
        note: 'Registration Reward',
        status: 'completed',
        createdAt: timeStr
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

      if (!user || Object.keys(user).length === 0 || !user.phone) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (String(user.password) !== String(password)) {
        return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
      }

      const currentDate = getUgandanFullDate() // <- FIXED: Using YYYY-MM-DD
      const safeUser = {
        username: String(user.username),
        phone: String(user.phone),
        inviteCode: String(user.inviteCode || ''), 
        vip: toNum(user.vip),
        availableBalance: toNum(user.availableBalance, 2500),
        books_read_today: toNum(user.books_read_today),
        dailyIncome: toNum(user.dailyIncome),
        createdAt: String(user.createdAt || currentDate) 
      }

      return NextResponse.json({ success: true, user: safeUser })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error("Auth server error details:", err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}