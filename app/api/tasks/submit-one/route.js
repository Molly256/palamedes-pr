import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

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

  // If user entered 2567... convert to 07...
  if (phone.startsWith('256') && phone.length === 12) {
    phone = '0' + phone.slice(3)
  }

  // Must be 10 digits starting with 07
  if (!/^07\d{8}$/.test(phone)) {
    return ''
  }

  return phone
}

const VIP_CONFIG = {
 0: { perBook: 625 },
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
    const { phone, taskId } = await request.json()

    if (!phone ||!taskId) {
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

    const userKey = `user:${normalizedPhone}`
    const user = await kv.hgetall(userKey)
    if (!user || Object.keys(user).length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const vipLevel = Number(user.vip) || Number(user.vip_level) || 0
    const reward = VIP_CONFIG[vipLevel]?.perBook || 625

    // Get task status from hash: task:phone:YYYY-MM-DD
    const taskKey = `task:${normalizedPhone}:${today}`
    const taskStatus = await kv.hget(taskKey, String(taskId))

    if (!taskStatus) {
      return NextResponse.json({ success: false, message: 'Task not found for today' }, { status: 404 })
    }

    if (taskStatus === 'submitted') {
      return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })
    }

    if (taskStatus!== 'read' && taskStatus!== 'pending') {
      return NextResponse.json({ success: false, message: 'Task not ready to submit' }, { status: 400 })
    }

    const pipe = kv.pipeline()

    // Mark task as submitted
    pipe.hset(taskKey, String(taskId), 'submitted')

    // Update balance
    const currentBalance = Number(user.balance || user.available_balance || 0)
    const newBalance = currentBalance + reward
    pipe.hset(userKey, {
      balance: String(newBalance),
      available_balance: String(newBalance)
    })

    // Add transaction
    pipe.lpush(`transactions:${normalizedPhone}`, JSON.stringify({
      type: 'daily_income',
      amount: reward,
      date: new Date().toISOString(),
      status: 'success',
      desc: `Task ${taskId} completed`
    }))

    // Check if all tasks done and lock VIP
    const allTasks = await kv.hgetall(taskKey)
    const totalTasks = Object.keys(allTasks).length
    const doneTasks = Object.values(allTasks).filter(v => v === 'submitted').length + 1

    if (doneTasks >= totalTasks) {
      pipe.hset(userKey, {
        tasksCompleted: String(totalTasks),
        vipLocked: 'true'
      })
    }

    await pipe.exec()

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