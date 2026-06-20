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

    const userRes = await db.execute('SELECT * FROM users WHERE phone =?', [normalizedPhone])
    const user = userRes.rows[0]
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const vipLevel = Number(user.vip) || Number(user.vip_level) || 0
    const reward = VIP_CONFIG[vipLevel]?.perBook || 0

    const taskRes = await db.execute(
      'SELECT status FROM daily_tasks WHERE phone =? AND date =? AND bookId =?',
      [normalizedPhone, today, String(bookId)]
    )
    const task = taskRes.rows[0]

    if (!task) {
      return NextResponse.json({ success: false, message: 'Task not found for today' }, { status: 404 })
    }

    if (task.status === 'submitted') {
      return NextResponse.json({ success: false, message: 'Already submitted' }, { status: 400 })
    }

    // Only allow submit if still pending
    if (task.status!== 'pending') {
      return NextResponse.json({ success: false, message: 'Invalid task status' }, { status: 400 })
    }

    const currentBalance = Number(user.balance || user.available_balance || 0)
    const newBalance = currentBalance + reward

    await db.transaction(async (tx) => {
      // Mark as submitted
      await tx.execute(
        'UPDATE daily_tasks SET status =? WHERE phone =? AND date =? AND bookId =?',
        ['submitted', normalizedPhone, today, String(bookId)]
      )

      // Update balance
      await tx.execute(
        'UPDATE users SET balance =?, available_balance =? WHERE phone =?',
        [String(newBalance), String(newBalance), normalizedPhone]
      )

      // Log transaction
      await tx.execute(
        `INSERT INTO transactions(id, phone, type, amount, date, status, desc)
         VALUES (?,?,?,?,?,?,?)`,
        [
          String(Date.now()),
          normalizedPhone,
          'daily_income',
          reward,
          new Date().toISOString(),
          'success',
          `Book ${bookId} completed`
        ]
      )

      // Check if all tasks done for today
      const allTasksRes = await tx.execute(
        'SELECT status FROM daily_tasks WHERE phone =? AND date =?',
        [normalizedPhone, today]
      )
      const allTasks = allTasksRes.rows
      const totalTasks = allTasks.length
      const doneTasks = allTasks.filter(t => t.status === 'submitted').length

      if (doneTasks >= totalTasks && totalTasks > 0) {
        await tx.execute(
          'UPDATE users SET tasksCompleted =?, vipLocked =? WHERE phone =?',
          [String(totalTasks), 'true', normalizedPhone]
        )
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