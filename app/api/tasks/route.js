import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

const TZ = 'Africa/Kampala'

function getUGDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
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
    const vip = Number(user.vip) || 0
    const config = VIP_CONFIG[vip] || VIP_CONFIG[0]

    const taskKey = `task:${phone}:${today}`
    const oldSetKey = `tasks:${phone}:${today}`

    // Get existing task data
    let taskData = await kv.hgetall(taskKey) || {}

    // If no tasks, check for old format and migrate
    if (Object.keys(taskData).length === 0) {
      const oldTaskIds = await kv.smembers(oldSetKey)

      if (oldTaskIds && oldTaskIds.length > 0) {
        // Migrate from old format to new format
        for (let i = 0; i < oldTaskIds.length; i++) {
          taskData[`book${i + 1}`] = 'pending'
        }
        await kv.hset(taskKey, taskData)
        // Delete old set to avoid confusion
        await kv.del(oldSetKey)
      } else {
        // Create fresh tasks for today
        taskData = {}
        for (let i = 1; i <= config.books; i++) {
          taskData[`book${i}`] = 'pending'
        }
        await kv.hset(taskKey, taskData)
      }
    }

    // Build response
    const tasks = Object.keys(taskData)
     .sort((a, b) => Number(a.replace('book', '')) - Number(b.replace('book', '')))
     .map(k => ({
        taskId: k,
        bookId: Number(k.replace('book', '')),
        status: taskData[k],
        reward: config.perBook
      }))

    const completed = tasks.filter(t => t.status === 'submitted').length

    return NextResponse.json({
      success: true,
      tasks,
      completed,
      total: config.books
    })

  } catch (err) {
    console.error('Tasks GET error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}