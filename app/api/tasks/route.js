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

  // Convert 256753520252 -> 0753520252
  if (phone.startsWith('256') && phone.length === 12) {
    phone = '0' + phone.slice(3)
  }

  // Convert 753520252 -> 0753520252
  if (phone.length === 9 &&!phone.startsWith('0')) {
    phone = '0' + phone
  }

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

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = normalizePhone(searchParams.get('phone'))

    if (!phone) {
      return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    const user = await kv.hgetall(`user:${phone}`)
    if (!user || Object.keys(user).length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const today = getUGDateStr()
    const day = getUGDayOfWeek()
    const vip = Number(user.vip) || 0
    const config = VIP_CONFIG[vip] || VIP_CONFIG[0]

    if (day === 'Saturday' || day === 'Sunday') {
      return NextResponse.json({ success: false, message: 'No tasks available' })
    }

    const dailyTasks = await kv.get(`tasks:daily:${today}`)
    if (!dailyTasks ||!dailyTasks.books) {
      return NextResponse.json({ success: false, message: 'No tasks available' })
    }

    const taskKey = `task:${phone}:${today}`
    const userStatus = await kv.hgetall(taskKey) || {}

    const tasks = dailyTasks.books.slice(0, config.books).map(book => ({
      taskId: book.id,
      bookId: book.id,
      title: book.title,
      cover: book.cover,
      preview: book.preview,
      status: userStatus[book.id] || 'pending',
      reward: config.perBook
    }))

    const completed = tasks.filter(t => t.status === 'submitted').length

    return NextResponse.json({
      success: true,
      tasks,
      completed,
      total: tasks.length,
      balance: Number(user.balance) || 0 // fixed: use balance
    })

  } catch (err) {
    console.error('Tasks GET error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { phone, taskId } = body

    if (!phone ||!taskId) {
      return NextResponse.json({ success: false, message: 'Phone and taskId required' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)
    const today = getUGDateStr()
    const day = getUGDayOfWeek()

    if (day === 'Saturday' || day === 'Sunday') {
      return NextResponse.json({ success: false, message: 'No tasks available on weekends' }, { status: 400 })
    }

    const userKey = `user:${normalizedPhone}`
    const user = await kv.hgetall(userKey)
    if (!user || Object.keys(user).length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const vip = Number(user.vip) || 0
    const config = VIP_CONFIG[vip] || VIP_CONFIG[0]
    const taskKey = `task:${normalizedPhone}:${today}`

    const currentStatus = await kv.hget(taskKey, taskId)
    if (!currentStatus) {
      return NextResponse.json({ success: false, message: 'Task not found for today' }, { status: 404 })
    }

    if (currentStatus === 'submitted') {
      return NextResponse.json({ success: false, message: 'Task already submitted' }, { status: 400 })
    }

    const pipe = kv.pipeline()
    pipe.hset(taskKey, { [taskId]: 'submitted' })
    pipe.hincrby(userKey, 'balance', config.perBook) // fixed: use balance
    pipe.lpush(`transactions:${normalizedPhone}`, JSON.stringify({
      type: 'daily_income',
      amount: config.perBook,
      date: new Date().toISOString(),
      status: 'success',
      desc: `Task ${taskId} completed`
    }))

    const allTaskData = await kv.hgetall(taskKey)
    const updatedTaskData = {...allTaskData, [taskId]: 'submitted' }

    const dailyTasks = await kv.get(`tasks:daily:${today}`)
    if (dailyTasks?.books) {
      const todaysBookIds = dailyTasks.books.slice(0, config.books).map(b => b.id)
      const allDone = todaysBookIds.every(id => updatedTaskData[id] === 'submitted')

      if (allDone) {
        pipe.hset(userKey, {
          tasksCompleted: config.books,
          vipLocked: 'true'
        })
      }
    }

    await pipe.exec()

    const newBalance = (Number(user.balance) || 0) + config.perBook

    return NextResponse.json({
      success: true,
      message: 'Task submitted successfully',
      reward: config.perBook,
      balance: newBalance // fixed
    })

  } catch (err) {
    console.error('Tasks POST error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}