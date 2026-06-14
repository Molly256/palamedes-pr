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
 0: { books: 4 }, 1: { books: 4 }, 2: { books: 4 }, 3: { books: 4 },
 4: { books: 5 }, 5: { books: 5 }, 6: { books: 5 }, 7: { books: 5 },
 8: { books: 5 }, 9: { books: 5 }, 10: { books: 5 },
}

export async function POST(request) {
  try {
    const { phone, taskIncome } = await request.json()
    
    if (!phone || !taskIncome) {
      return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })
    }

    const normalizedPhone = normalizePhone(phone)
    const today = getUGDateStr()
    const income = Number(taskIncome)

    // Get user to know VIP level and max books
    const user = await kv.hgetall(`user:${normalizedPhone}`)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const vipLevel = Number(user.vip) || 0
    const maxBooks = VIP_CONFIG[vipLevel]?.books || 4

    // 1. Save task submission for today
    const taskData = {}
    for (let i = 1; i <= maxBooks; i++) {
      taskData[`book${i}`] = 'submitted'
    }
    taskData.income = income
    taskData.submittedAt = new Date().toISOString()

    await kv.hset(`task:${normalizedPhone}:${today}`, taskData)

    // 2. Push to transactions list - this is what shows in My tab
    await kv.lpush(`transactions:${normalizedPhone}`, JSON.stringify({
      type: 'task_reward',
      amount: income,
      date: new Date().toISOString(),
      status: 'success',
      desc: 'Daily tasks completed'
    }))

    // 3. Update user balance, tasksCompleted, and lock tasks
    await kv.hincrby(`user:${normalizedPhone}`, 'balance', income)
    await kv.hset(`user:${normalizedPhone}`, {
      tasksCompleted: maxBooks,
      vipLocked: 'true'
    })

    return NextResponse.json({ success: true, message: 'Tasks submitted' })
    
  } catch (err) {
    console.error('Task submit error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}