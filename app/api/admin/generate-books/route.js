export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import fs from 'fs/promises'
import path from 'path'
import { VIPS } from '@/app/api/viplevels/route'

const redis = Redis.fromEnv()

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

function shuffle(array) {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export async function POST() {
  try {
    const today = getUgandaDateString()
    const coversDir = path.join(process.cwd(), 'public/books/covers')

    // 1. Get valid cover IDs: 1.jpg -> "1"
    const coverFiles = await fs.readdir(coversDir)
    const coverIds = coverFiles
     .map(f => f.replace(/\.jpg$/i, ''))
     .filter(id => /^\d+$/.test(id))
     .map(String)

    if (coverIds.length < 4) {
      return NextResponse.json({ success: false, message: 'Need at least 4 cover images' }, { status: 500 })
    }

    // 2. Pick 4 random IDs. VIP1-3 all need 4
    const bookIds = shuffle(coverIds).slice(0, 4)
    const perBookReward = VIPS[1].perBook // 625. Use VIP1 rate for everyone

    // 3. Get all users with hasBoughtVip=true
    const userKeys = await redis.keys('user:*')
    const users = await Promise.all(userKeys.map(k => redis.hgetall(k)))
    const vipUsers = users.filter(u => u.hasBoughtVip === 'true' && u.phone)

    if (vipUsers.length === 0) {
      return NextResponse.json({ success: true, message: 'No VIP users found', usersUpdated: 0 })
    }

    // 4. Write to Redis for each user
    const pipeline = redis.pipeline()
    vipUsers.forEach(user => {
      const phone = user.phone
      const setKey = `books:${phone}:${today}`

      pipeline.del(setKey) // overwrite today's books
      bookIds.forEach(bookId => {
        const bookKey = `book:${phone}:${today}:${bookId}`
        pipeline.hset(bookKey, {
          phone,
          bookId,
          status: 'pending',
          reward: perBookReward,
          date: today,
          createdAt: Date.now()
        })
        pipeline.sadd(setKey, bookId)
      })
    })
    await pipeline.exec()

    return NextResponse.json({
      success: true,
      message: `Generated 4 books for ${vipUsers.length} users`,
      bookIds,
      usersUpdated: vipUsers.length
    })

  } catch (err) {
    console.error('Generate books error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}