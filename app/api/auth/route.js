import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// Debug: check if env vars are loaded
console.log("UPSTASH_URL:", process.env.UPSTASH_REDIS_REST_URL)
console.log("UPSTASH_TOKEN:", process.env.UPSTASH_REDIS_REST_TOKEN ? "exists" : "missing")

export async function POST(req) {
  try {
    const body = await req.json()
    const { action } = body

    if (action === 'register') {
      const { username, phone, password } = body

      if (!/^[a-zA-Z0-9]{6}$/.test(username)) {
        return NextResponse.json({ error: 'Username must be 6 alphanumeric chars' }, { status: 400 })
      }
      if (!/^07\d{8}$/.test(phone)) {
        return NextResponse.json({ error: 'Phone must be 07XXXXXXXX' }, { status: 400 })
      }
      if (!/^[a-zA-Z0-9]{6}$/.test(password)) {
        return NextResponse.json({ error: 'Password must be 6 alphanumeric chars' }, { status: 400 })
      }

      const exists = await redis.hgetall(`user:${phone}`)
      if (exists && Object.keys(exists).length > 0) {
        return NextResponse.json({ error: 'Phone already registered' }, { status: 400 })
      }

      const userInviteCode = `PM${phone.slice(-6)}`

      await redis.hset(`user:${phone}`, {
        username,
        phone,
        password,
        inviteCode: userInviteCode,
        balance: 2500,
        createdAt: Date.now()
      })

      return NextResponse.json({ success: true, inviteCode: userInviteCode })
    }

    if (action === 'login') {
      const { phone, password } = body

      if (!/^07\d{8}$/.test(phone)) {
        return NextResponse.json({ error: 'Invalid phone' }, { status: 400 })
      }

      const user = await redis.hgetall(`user:${phone}`)
      if (!user || Object.keys(user).length === 0) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }

      // Convert both to string to avoid number vs string mismatch
      const passwordFromDB = String(user.password)
      const passwordFromInput = String(password)

      console.log("DB password:", passwordFromDB)
      console.log("Input password:", passwordFromInput)
      console.log("Match:", passwordFromDB === passwordFromInput)

      if (passwordFromDB !== passwordFromInput) {
        return NextResponse.json({ error: 'Wrong password' }, { status: 401 })
      }

      const { password: _, ...userData } = user
      return NextResponse.json({ success: true, user: userData })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error("Auth route error:", err)
    return NextResponse.json({ error: 'Server error', detail: err.message }, { status: 500 })
  }
}