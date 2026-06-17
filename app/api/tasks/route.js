import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'
import booksData from '../../../data/books.json'

const TZ = 'Africa/Kampala'

function getUGDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

function getUGDayOfWeek(date = new Date()) {
  return new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'long' }).format(date)
}

function normalizePhone(phone) {
  if (!phone) return ''
  phone = String(phone).replace(/\D/g, '')

  // Convert 256753520252 -> 0753520252
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
      return NextResponse.json({ success: false, message: 'Phone must be 10 digits starting with 07' }, { status: 400 })
    }

    const user = await kv.hgetall(`user:${phone}`)
    if (!user || Object.keys(user).length === 0) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const today = getUGDateStr()
    const day = getUGDayOfWeek()
    const vip = Number(user.vip) || Number(user.vip_level) || 0
    const config = VIP_CONFIG[vip] || VIP_CONFIG[0]

    if (day === 'Saturday' || day === 'Sunday') {
      return NextResponse.json({ success: false, message: 'No tasks available' })
    }

    // Read from hash: task:phone:YYYY-MM-DD
    const taskKey = `task:${phone}:${today}`
    const taskHash = await kv.hgetall(taskKey)

    if (!taskHash || Object.keys(taskHash).length === 0) {
      return NextResponse.json({ success: false, message: 'No tasks available' })
    }

    // Get book details from books.json and merge with status from hash
    const bookIds = Object.keys(taskHash).slice(0, config.books)
    const books = booksData
    .filter(b => bookIds.includes(String(b.id)))
    .map(b => ({
        id: String(b.id),
        title: b.title,
        cover: b.cover,
        preview: b.preview,
        status: taskHash[b.id] || 'pending',
        reward: config.perBook
      }))

    const completed = books.filter(t => t.status === 'submitted').length
    const balance = Number(user.balance || user.available_balance || 0)

    return NextResponse.json({
      success: true,
      books,
      completed,
      total: books.length,
      balance,
      available_balance: balance
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
    if (!normalizedPhone) {
      return NextResponse.json({ success: false, message: 'Phone must be 10 digits starting with 07' }, { status: 400 })
    }

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

    const vip = Number(user.vip) || Number(user.vip_level) || 0
    const config = VIP_CONFIG[vip] || VIP_CONFIG[0]
    const taskKey = `task:${normalizedPhone}:${today}`

    const taskStatus = await kv.hget(taskKey, String(taskId))
    if (!taskStatus) {
      return NextResponse.json({ success: false, message: 'Task not found for today' }, { status: 404 })
    }

    if (taskStatus === 'submitted') {
      return NextResponse.json({ success: false, message: 'Task already submitted' }, { status: 400 })
    }

    // Mark this book as submitted
    const pipe = kv.pipeline()
    pipe.hset(taskKey, String(taskId), 'submitted')

    const currentBalance = Number(user.balance || user.available_balance || 0)
    const newBalance = currentBalance + config.perBook
    pipe.hset(userKey, {
      balance: String(newBalance),
      available_balance: String(newBalance)
    })
    pipe.lpush(`transactions:${normalizedPhone}`, JSON.stringify({
      type: 'daily_income',
      amount: config.perBook,
      date: new Date().toISOString(),
      status: 'success',
      desc: `Task ${taskId} completed`
    }))

    // Check if all tasks done
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
      message: 'Task submitted successfully',
      reward: config.perBook,
      balance: newBalance,
      available_balance: newBalance
    })

  } catch (err) {
    console.error('Tasks POST error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}