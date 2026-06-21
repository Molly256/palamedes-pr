import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

const ADMIN_KEY = process.env.ADMIN_TASK_KEY

const VIP_CONFIG = {
 1: { tasks: 4, perBook: 625 },
 2: { tasks: 4, perBook: 2000 },
 3: { tasks: 4, perBook: 6500 },
 4: { tasks: 5, perBook: 7000 },
 5: { tasks: 5, perBook: 10000 },
 6: { tasks: 5, perBook: 14000 },
 7: { tasks: 5, perBook: 28000 },
 8: { tasks: 5, perBook: 32000 },
 9: { tasks: 5, perBook: 40000 },
 10: { tasks: 5, perBook: 60000 },
}

function generateId() {
  return `dt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
}

function getTodayDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export async function POST(request) {
  try {
    const { key } = await request.json()
    if (key!== ADMIN_KEY) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
    }

    const today = getTodayDate()

    // Get users with hasBoughtVIP=true AND no daily_tasks for today
    const users = await db`
      SELECT u.phone, u.vip
      FROM users u
      LEFT JOIN daily_tasks dt ON u.phone = dt.phone AND dt.date = ${today}
      WHERE u.hasBoughtVIP = 'true'
        AND u.vip > 0
        AND dt.phone IS NULL
    `

    if (users.length === 0) {
      return NextResponse.json({
        success: true,
        message: `No users need daily tasks for ${today}. All active VIP users already have tasks.`
      })
    }

    const tasksToInsert = []
    let totalTasks = 0

    for (const user of users) {
      const vipLevel = Number(user.vip)
      const config = VIP_CONFIG[vipLevel]
      if (!config) continue

      for (let i = 0; i < config.tasks; i++) {
        tasksToInsert.push({
          id: generateId(),
          phone: user.phone,
          vip_level: vipLevel,
          reward: config.perBook,
          status: 'pending',
          date: today,
          meta: JSON.stringify({ bookIndex: i + 1 }),
          created_at: new Date().toISOString()
        })
      }
      totalTasks += config.tasks
    }

    if (tasksToInsert.length > 0) {
      // Neon doesn't support bulk INSERT with array of arrays directly
      // Use Promise.all for batch insert
      await Promise.all(
        tasksToInsert.map(t => db`
          INSERT INTO daily_tasks (id, phone, vip_level, reward, status, date, meta, created_at)
          VALUES (${t.id}, ${t.phone}, ${t.vip_level}, ${t.reward}, ${t.status}, ${t.date}, ${t.meta}, ${t.created_at})
        `)
      )
    }

    return NextResponse.json({
      success: true,
      message: `Generated ${totalTasks} daily tasks for ${users.length} users for ${today}`,
      users: users.map(u => u.phone)
    })

  } catch (err) {
    console.error('Generate daily tasks error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}