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

// SIMPLIFIED: Generates pure Ugandan YY-MM-DD right at registration
const getUgandanShortDate = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Kampala',
    year: '2-digit',   
    month: '2-digit',  
    day: '2-digit'     
  }).formatToParts(new Date())

  const year = parts.find(p => p.type === 'year').value
  const month = parts.find(p => p.type === 'month').value
  const day = parts.find(p => p.type === 'day').value

  return `${year}-${month}-${day}` 
}

export async function POST(req) {
  try {
    const { action, username, phone, password, referrerCode } = await req.json()
    
    // ==========================================
    // ACTION: REGISTER
    // ==========================================
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
      const date = getUgandanShortDate() 
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

      if (directInviterPhone && directInviterPhone !== phone) {
        userProfile.invited_by = String(directInviterPhone)
      }

      pipeline.hset(userKey, userProfile)
      pipeline.set(`invite_code_map:${inviteCode}`, phone)

      pipeline.lpush(`tx:${phone}:${date}`, JSON.stringify({
        id: crypto.randomUUID(),
        type: 'system_increase',
        amount: '2500',
        note: 'Registration Reward',
        status: 'completed',
        createdAt: String(date)
      }));

      await pipeline.exec()

      return NextResponse.json({ success: true, inviteCode })
    }

    // ==========================================
    // ACTION: LOGIN
    // ==========================================
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

      // FIXED: Safely reads the original parameter type directly into your number processing utility
      const safeUser = {
        username: String(user.username),
        phone: String(user.phone),
        inviteCode: String(user.inviteCode || ''),
        vip: toNum(user.vip),
        availableBalance: toNum(user.availableBalance, 2500), // Default value match if empty
        books_read_today: toNum(user.books_read_today),
        dailyIncome: toNum(user.dailyIncome),
        createdAt: String(user.createdAt || getUgandanShortDate()) 
      }

      return NextResponse.json({ success: true, user: safeUser })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error("Auth server error details:", err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}