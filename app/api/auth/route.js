export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const redis = Redis.fromEnv()

const toNum = function(v, f) {
  if (f === undefined) f = 0
  if (v === undefined || v === null) return f
  const n = Number(v)
  return Number.isNaN(n) ? f : n
}

const getUgandanFullDate = function() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

const getUgandanDateTimeString = function() {
  return new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).slice(0,16).replace(',', ' ')
}

export async function POST(req) {
  try {
    const body = await req.json()
    const action = body.action
    const username = body.username
    const phone = body.phone
    const password = body.password
    const inviterCode = body.inviterCode 
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
      
      // 🛑 INVITE CODE MANDATORY RESTRICTION CHECK
      if (!referrerCode || !/^PM\d{6}$/.test(referrerCode)) {
        return NextResponse.json({ error: 'Valid invite code required' }, { status: 400 })
      }

      const userKey = 'user:' + String(phone).trim()
      const exists = await redis.hget(userKey, 'phone')
      
      if (exists) {
        return NextResponse.json({ error: 'Phone already registered' }, { status: 400 })
      }

      const inviteCode = 'PM' + String(phone).slice(-6)
      const date = getUgandanFullDate() 
      const timeStr = getUgandanDateTimeString()
      const pipeline = redis.pipeline()

      let directInviterPhone = null

      if (referrerCode && /^PM\d{6}$/.test(referrerCode)) {
        directInviterPhone = await redis.get('invite_code_map:' + referrerCode) 
        
        if (directInviterPhone && String(directInviterPhone) !== String(phone)) {
          const cleanInviter = String(directInviterPhone).trim()
          const newUserPhoneKey = String(phone).trim()
          
          const parentData = await redis.hget('user:' + cleanInviter, 'invited_by')
          const grandparentPhone = parentData ? String(parentData).trim() : null
          
          let greatGrandparentPhone = null
          if (grandparentPhone) {
            const grandData = await redis.hget('user:' + grandparentPhone, 'invited_by')
            greatGrandparentPhone = grandData ? String(grandData).trim() : null
          }

          const dataA = {}
          dataA[newUserPhoneKey] = '1'
          pipeline.hset('downlines:' + cleanInviter, dataA)

          if (grandparentPhone && grandparentPhone !== newUserPhoneKey) {
            const dataB = {}
            dataB[newUserPhoneKey] = '2'
            pipeline.hset('downlines:' + grandparentPhone, dataB)

            if (greatGrandparentPhone && greatGrandparentPhone !== newUserPhoneKey) {
              const dataC = {}
              dataC[newUserPhoneKey] = '3'
              pipeline.hset('downlines:' + greatGrandparentPhone, dataC)
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

      if (directInviterPhone && String(directInviterPhone) !== String(phone)) {
        userProfile.invited_by = String(directInviterPhone).trim()
      } else {
        userProfile.invited_by = ''
      }

      pipeline.hset(userKey, userProfile)
      pipeline.set('invite_code_map:' + inviteCode, String(phone).trim()) 

      const txPayload = JSON.stringify({
        id: crypto.randomUUID(),
        type: 'system_increase', 
        label: 'Registration Reward', 
        amount: '2500',
        note: 'Registration Reward',
        status: 'success', 
        createdAt: timeStr
      });

      pipeline.lpush('tx:' + String(phone).trim() + ':' + date, txPayload)
      pipeline.lpush('tx:' + String(phone).trim() + ':history', txPayload)

      await pipeline.exec()
      return NextResponse.json({ success: true, inviteCode: inviteCode }) 
    }

    if (action === 'login') {
      if (!/^07\d{8}$/.test(phone) || !password) {
        return NextResponse.json({ error: 'Invalid phone or password' }, { status: 400 })
      }

      const userKey = 'user:' + String(phone).trim()
      const user = await redis.hgetall(userKey)

      if (!user || Object.keys(user).length === 0 || !user.phone) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      if (String(user.password) !== String(password)) {
        return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
      }

      const currentDate = getUgandanFullDate() 

      const rawDownlines = await redis.hgetall('downlines:' + String(phone).trim()) || {}
      
      let teamACount = 0
      let teamBCount = 0
      let teamCCount = 0

      const keys = Object.keys(rawDownlines);
      for (let i = 0; i < keys.length; i++) {
        const val = rawDownlines[keys[i]];
        if (val === '1') teamACount++
        else if (val === '2') teamBCount++
        else if (val === '3') teamCCount++
      }

      const safeUser = {
        username: String(user.username),
        phone: String(user.phone),
        inviteCode: String(user.inviteCode || ''), 
        vip: toNum(user.vip),
        availableBalance: toNum(user.availableBalance, 2500),
        books_read_today: toNum(user.books_read_today),
        dailyIncome: toNum(user.dailyIncome),
        createdAt: String(user.createdAt || currentDate),
        teamStats: {
          teamA: teamACount,
          teamB: teamBCount,
          teamC: teamCCount,
          totalTeamSize: teamACount + teamBCount + teamCCount
        }
      }

      return NextResponse.json({ success: true, user: safeUser })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })

  } catch (err) {
    console.error("Auth server error details:", err)
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}