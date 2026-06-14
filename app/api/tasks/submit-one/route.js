import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

const TZ = 'Africa/Kampala'

function getUGDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')
  if (phone.length === 9 && !phone.startsWith('0')) phone = '0' + phone
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

    if (!phone || !taskId) {
      return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)
    const today = getUGDateStr()

    const user = await kv.hgetall(`user:${normalizedPhone}`)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const vipLevel = Number(user.vip) || 0
    const reward = VIP_CONFIG[vipLevel]?.perBook || 625
    const maxBooks = VIP_CONFIG[vipLevel]?.books || 4

    const taskKey = `task:${normalizedPhone}:${today}`
    const taskData = await kv.hgetall(taskKey)
    if (!taskData) return NextResponse.json({ success: false, message: 'No tasks for today' }, { status: 404 })

    if (taskData[taskId] === 'submitted') {
      return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })
    }

    // Mark this book as submitted
    await kv.hset(taskKey, { [taskId]: 'submitted' })

    // Add reward
    await kv.hincrby(`user:${normalizedPhone}`, 'balance', reward)

    // Save transaction
    await kv.lpush(`transactions:${normalizedPhone}`, JSON.stringify({
      type: 'task_reward',
      amount: reward,
      date: new Date().toISOString(),
      status: 'success',
      desc: `Task ${taskId} completed`
    }))

    // Check if all books are done
    const updatedTaskData = await kv.hgetall(taskKey)
    let allDone = true
    for (let i = 1; i <= maxBooks; i++) {
      if (updatedTaskData[`book${i}`] !== 'submitted') {
        allDone = false
        break
      }
    }

    if (allDone) {
      await kv.hset(`user:${normalizedPhone}`, {
        tasksCompleted: maxBooks,
        vipLocked: 'true'
      })
    }

    return NextResponse.json({ success: true, reward })

  } catch (err) {
    console.error('Submit-one error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}