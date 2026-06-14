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
 0: { books: 4, reward: 625 },
 1: { books: 4, reward: 625 },
 2: { books: 4, reward: 2000 },
 3: { books: 4, reward: 6500 },
 4: { books: 5, reward: 8000 },
 5: { books: 5, reward: 12000 },
 6: { books: 5, reward: 15000 },
 7: { books: 5, reward: 20000 },
 8: { books: 5, reward: 25000 },
 9: { books: 5, reward: 30000 },
 10: { books: 5, reward: 35000 },
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

    // VIP0: only on registration day
    if (vip === 0) {
      if (today !== user.regDate) {
        return NextResponse.json({ 
          success: true, 
          tasks: [], 
          message: 'VIP0 tasks expired. Upgrade to continue.'
        })
      }
    }

    // Check if tasks exist for today
    let taskIds = await kv.smembers(`tasks:${phone}:${today}`)
    
    // If no tasks exist, create them now
    if (!taskIds || taskIds.length === 0) {
      const tasks = []
      for (let i = 1; i <= config.books; i++) {
        const taskId = `vip${vip}_${phone}_${today}_${i}`
        await kv.hset(taskId, {
          userPhone: phone,
          vipLevel: String(vip),
          bookId: i,
          reward: String(config.reward),
          status: 'pending',
          date: today
        })
        tasks.push(taskId)
      }
      await kv.sadd(`tasks:${phone}:${today}`, ...tasks)
      taskIds = tasks
    }

    // Fetch all task data
    const tasks = await Promise.all(taskIds.map(id => kv.hgetall(id)))
    const validTasks = tasks.filter(t => t && Object.keys(t).length > 0)

    // Check completed count for today
    const completedData = await kv.hgetall(`task:${phone}:${today}`)
    const completedCount = completedData?.income ? config.books : 0

    return NextResponse.json({ 
      success: true, 
      tasks: validTasks,
      completed: completedCount,
      total: config.books
    })
    
  } catch (err) {
    console.error('Tasks GET error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}