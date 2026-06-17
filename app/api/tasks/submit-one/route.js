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
    const reward = VIP_CONFIG[vipLevel]?.perBook || 0

    const taskKey = `task:${normalizedPhone}:${today}`
    const taskStatus = await kv.hget(taskKey, String(taskId))

    if (!taskStatus) {
      return NextResponse.json({ success: false, message: 'Task not found for today' }, { status: 404 })
    }

    if (taskStatus === '1') {
      return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })
    }

    if (taskStatus!== '0' && taskStatus!== '2') {
      return NextResponse.json({ success: false, message: 'Task not ready to submit' }, { status: 400 })
    }

    const pipe = kv.pipeline()

    // Mark task as submitted: 1 = submitted
    pipe.hset(taskKey, String(taskId), '1')

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

    await pipe.exec()

    // Check if all tasks done AFTER update
    const allTasks = await kv.hgetall(taskKey)
    const totalTasks = Object.keys(allTasks).length
    const doneTasks = Object.values(allTasks).filter(v => v === '1').length

    if (doneTasks >= totalTasks && totalTasks > 0) {
      await kv.hset(userKey, {
        tasksCompleted: String(totalTasks),
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