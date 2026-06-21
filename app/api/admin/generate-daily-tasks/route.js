import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const redis = Redis.fromEnv()
const ADMIN_KEY = process.env.ADMIN_TASK_KEY

const VIP_CONFIG = {
 1: { tasks: 4, perBook: 625 },
 2: { tasks: 4, perBook: 2000 },
 3: { tasks: 4, perBook: 6500 },
 4: { tasks: 5, perBook: 7000 },
 5: { tasks: 5, perBook: 10000 },
 6: { tasks: 5, perBook: 14000 },
 7: { tasks: 5, perBook: 28000 },
 8: { tasks: 5, perBook: 32000 },
 9: { tasks: 5, perBook: 40000 },
 10: { tasks: 5, perBook: 60000 },
}

function generateId() {
  return `dt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function getTodayDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export async function POST(request) {
  try {
    const { key } = await request.json()
    if (key!== ADMIN_KEY) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
    }

    const today = getTodayDate()

    // Get all phones with VIP
    const allPhones = await redis.smembers('users:phones')
    const usersNeedingTasks = []

    for (const phone of allPhones) {
      const user = await redis.hgetall(`user:${phone}`)
      if (!user || Object.keys(user).length === 0) continue

      const hasBoughtVIP = Number(user.hasBoughtVIP) === 1
      const vipLevel = Number(user.vip) || 0

      if (!hasBoughtVIP || vipLevel === 0) continue

      // Check if tasks already exist for today
      const existingTasks = await redis.smembers(`tasks:${phone}:${today}`)
      if (existingTasks.length === 0) {
        usersNeedingTasks.push({ phone, vipLevel })
      }
    }

    if (usersNeedingTasks.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No users need daily tasks for ${today}. All active VIP users already have tasks.`
      })
    }

    let totalTasks = 0

    for (const { phone, vipLevel } of usersNeedingTasks) {
      const config = VIP_CONFIG[vipLevel]
      if (!config) continue

      for (let i = 0; i < config.tasks; i++) {
        const bookId = `book_${i + 1}`
        const taskId = generateId()

        await redis.hset(`task:${phone}:${today}:${bookId}`, {
          id: taskId,
          bookId,
          phone,
          vip_level: vipLevel,
          reward: config.perBook,
          status: 'pending',
          date: today,
          meta: JSON.stringify({ bookIndex: i + 1 }),
          created_at: new Date().toISOString()
        })

        await redis.sadd(`tasks:${phone}:${today}`, bookId)
      }
      totalTasks += config.tasks
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${totalTasks} daily tasks for ${usersNeedingTasks.length} users for ${today}`,
      users: usersNeedingTasks.map(u => u.phone)
    })

  } catch (err) {
    console.error('Generate daily tasks error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}