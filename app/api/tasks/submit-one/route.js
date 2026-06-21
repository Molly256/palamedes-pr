import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()
const TZ = 'Africa/Kampala'

function getUGDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

function getUGDayOfWeek(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(date)
}

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')
  if (phone.startsWith('256') && phone.length === 12) {
    phone = '0' + phone.slice(3)
  }
  if (!/^07\d{8}$/.test(phone)) {
    return ''
  }
  return phone
}

const VIP_CONFIG = {
 1: { perBook: 625 },
 2: { perBook: 2000 },
 3: { perBook: 6500 },
 4: { perBook: 7000 },
 5: { perBook: 10000 },
 6: { perBook: 14000 },
 7: { perBook: 28000 },
 8: { perBook: 32000 },
 9: { perBook: 40000 },
 10: { perBook: 60000 },
}

export async function POST(request) {
  try {
    const { phone, bookId } = await request.json()

    if (!phone ||!bookId) {
      return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)
    if (!normalizedPhone) {
      return NextResponse.json({ success: false, message: 'Phone must be 10 digits starting with 07' }, { status: 400 })
    }

    const today = getUGDateStr()
    const day = getUGDayOfWeek()

    if (day === 'Saturday' || day === 'Sunday') {
      return NextResponse.json({ success: false, message: 'No tasks on weekends' }, { status: 400 })
    }

    const user = await redis.hgetall(`user:${normalizedPhone}`)
    if (!user || Object.keys(user).length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const vipLevel = Number(user.vip) || Number(user.vip_level) || 0
    const reward = VIP_CONFIG[vipLevel]?.perBook || 0

    const task = await redis.hgetall(`task:${normalizedPhone}:${today}:${bookId}`)
    if (!task || Object.keys(task).length === 0) {
      return NextResponse.json({ success: false, message: 'Task not found for today' }, { status: 404 })
    }

    if (task.status === 'submitted') {
      return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })
    }

    if (task.status!== 'pending') {
      return NextResponse.json({ success: false, message: 'Invalid task status' }, { status: 400 })
    }

    const currentBalance = Number(user.balance || user.available_balance || 0)
    const newBalance = currentBalance + reward

    // Mark as submitted
    await redis.hset(`task:${normalizedPhone}:${today}:${bookId}`, { status: 'submitted' })

    // Update balance
    await redis.hset(`user:${normalizedPhone}`, {
      balance: newBalance,
      available_balance: newBalance
    })

    // Log transaction
    const txId = String(Date.now())
    await redis.lpush(`tx:${normalizedPhone}`, JSON.stringify({
      id: txId,
      phone: normalizedPhone,
      type: 'daily_income',
      amount: reward,
      date: new Date().toISOString(),
      status: 'success',
      desc: `Book ${bookId} completed`
    }))

    // Check if all tasks done for today
    const taskIds = await redis.smembers(`tasks:${normalizedPhone}:${today}`)
    let doneTasks = 0
    let totalTasks = taskIds.length

    for (const tid of taskIds) {
      const t = await redis.hgetall(`task:${normalizedPhone}:${today}:${tid}`)
      if (t.status === 'submitted') doneTasks++
    }

    if (doneTasks >= totalTasks && totalTasks > 0) {
      await redis.hset(`user:${normalizedPhone}`, {
        tasksCompleted: totalTasks,
        vipLocked: 'true'
      })
    }

    return NextResponse.json({
      success: true,
      reward,
      balance: newBalance,
      available_balance: newBalance
    })

  } catch (err) {
    console.error('Submit-one error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}