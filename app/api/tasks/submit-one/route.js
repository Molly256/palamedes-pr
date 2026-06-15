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
  if (phone.length === 9 &&!phone.startsWith('0')) phone = '0' + phone
  return phone
}

const VIP_CONFIG = {
 0: { books: 4, perBook: 625 },
 1: { books: 4, perBook: 625 },
 2: { books: 4, perBook: 2000 },
 3: { books: 4, perBook: 6500 },
 4: { books: 5, perBook: 7000 },
 5: { books: 5, perBook: 10000 },
 6: { books: 5, perBook: 14000 },
 7: { books: 5, perBook: 28000 },
 8: { books: 5, perBook: 32000 },
 9: { books: 5, perBook: 40000 },
 10: { books: 5, perBook: 60000 },
}

export async function POST(request) {
  try {
    const { phone, taskId } = await request.json()

    if (!phone ||!taskId) {
      return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)
    const today = getUGDateStr()
    const day = getUGDayOfWeek()

    if (day === 'Saturday' || day === 'Sunday') {
      return NextResponse.json({ success: false, message: 'No tasks on weekends' }, { status: 400 })
    }

    const user = await kv.hgetall(`user:${normalizedPhone}`)
    if (!user || Object.keys(user).length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const vipLevel = Number(user.vip) || 0
    const reward = VIP_CONFIG[vipLevel]?.perBook || 625
    const maxBooks = VIP_CONFIG[vipLevel]?.books || 4
    const taskKey = `task:${normalizedPhone}:${today}`

    const currentStatus = await kv.hget(taskKey, taskId)
    if (!currentStatus) {
      return NextResponse.json({ success: false, message: 'Task not found for today' }, { status: 404 })
    }

    if (currentStatus === 'submitted') {
      return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })
    }

    const pipe = kv.pipeline()
    pipe.hset(taskKey, { [taskId]: 'submitted' })
    pipe.hincrby(`user:${normalizedPhone}`, 'available_balance', reward)
    pipe.lpush(`transactions:${normalizedPhone}`, JSON.stringify({
      type: 'daily_income',
      amount: reward,
      date: new Date().toISOString(),
      status: 'success',
      desc: `Task ${taskId} completed`
    }))

    const allTaskData = await kv.hgetall(taskKey)
    const updatedTaskData = {...allTaskData, [taskId]: 'submitted' }

    const dailyTasks = await kv.get(`tasks:daily:${today}`)
    if (dailyTasks?.books) {
      const todaysBookIds = dailyTasks.books.slice(0, maxBooks).map(b => b.id)
      const allDone = todaysBookIds.every(id => updatedTaskData[id] === 'submitted')

      if (allDone) {
        pipe.hset(`user:${normalizedPhone}`, {
          tasksCompleted: maxBooks,
          vipLocked: 'true'
        })
      }
    }

    await pipe.exec()

    const newBalance = (Number(user.available_balance) || 0) + reward

    return NextResponse.json({
      success: true,
      reward,
      available_balance: newBalance
    })

  } catch (err) {
    console.error('Submit-one error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}