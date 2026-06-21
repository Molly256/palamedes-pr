import { db } from '@/lib/db'
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

    const userRes = await db`SELECT * FROM users WHERE phone = ${normalizedPhone}`
    const user = userRes[0]
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const vipLevel = Number(user.vip) || Number(user.vip_level) || 0
    const reward = VIP_CONFIG[vipLevel]?.perBook || 0

    const taskRes = await db`
      SELECT status FROM daily_tasks
      WHERE phone = ${normalizedPhone} AND date = ${today} AND bookId = ${String(bookId)}
    `
    const task = taskRes[0]

    if (!task) {
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

    await db.transaction(async (tx) => {
      // Mark as submitted
      await tx`
        UPDATE daily_tasks
        SET status = 'submitted'
        WHERE phone = ${normalizedPhone} AND date = ${today} AND bookId = ${String(bookId)}
      `

      // Update balance
      await tx`
        UPDATE users
        SET balance = ${String(newBalance)}, available_balance = ${String(newBalance)}
        WHERE phone = ${normalizedPhone}
      `

      // Log transaction
      await tx`
        INSERT INTO transactions(id, phone, type, amount, date, status, desc)
        VALUES (
          ${String(Date.now())},
          ${normalizedPhone},
          'daily_income',
          ${reward},
          ${new Date().toISOString()},
          'success',
          ${`Book ${bookId} completed`}
        )
      `

      // Check if all tasks done for today
      const allTasksRes = await tx`
        SELECT status FROM daily_tasks
        WHERE phone = ${normalizedPhone} AND date = ${today}
      `

      const allTasks = allTasksRes
      const totalTasks = allTasks.length
      const doneTasks = allTasks.filter(t => t.status === 'submitted').length

      if (doneTasks >= totalTasks && totalTasks > 0) {
        await tx`
          UPDATE users
          SET tasksCompleted = ${String(totalTasks)}, vipLocked = 'true'
          WHERE phone = ${normalizedPhone}
        `
      }
    })

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