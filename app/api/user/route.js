import { kv } from '@vercel/kv'

const VIP_CONFIG = {
 0: { price: 0, books: 4, perBook: 625 },
 1: { price: 80000, books: 4, perBook: 625 },
 2: { price: 200000, books: 5, perBook: 1000 },
 3: { price: 500000, books: 6, perBook: 1500 },
 4: { price: 1000000, books: 8, perBook: 2500 }
}

const SHARE_CONFIG = {
  pride: { name: 'PRIDE AND PREJUDICE', price: 50000, daily: 0.01, cycle: 30 },
  hegel: { name: 'Hegel lectures', price: 50000, daily: 0.03, cycle: 120 },
  whale: { name: 'The whale', price: 50000, daily: 0.05, cycle: 180 }
}

function getKampalaTime() {
  return new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Kampala',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

function isWeekdayKampala() {
  const weekday = new Date().toLocaleDateString('en-US', {timeZone: 'Africa/Kampala', weekday: 'short'})
  return!['Sat','Sun'].includes(weekday)
}

function getTodayKey(phone) {
  const today = new Date().toLocaleDateString('en-CA', {timeZone: 'Africa/Kampala'})
  return `task:palamedes:${phone}:${today}`
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')?.replace(/\s+/g, '')
    const action = searchParams.get('action')

    if (!phone) return Response.json({ success: false, message: 'Phone required' })

    const user = await kv.hgetall(`phone:palamedes:${phone}`)
    if (!user ||!user.username) return Response.json({ success: false, message: 'User not found' })

    if (action === 'getShares') {
      const shares = await kv.hgetall(`share:palamedes:${phone}`)
      const parsedShares = {}
      for (const [id, data] of Object.entries(shares || {})) {
        parsedShares[id] = JSON.parse(data)
      }
      return Response.json({ success: true, shares: parsedShares })
    }

    if (action === 'getDashboard') {
      const txList = await kv.lrange(`tx:palamedes:${phone}`, 0, -1)
      const transactions = txList.map(t => JSON.parse(t))

      const vipTx = transactions.find(t => t.type === 'vip')
      const vipPurchaseDate = vipTx? vipTx.date : null

      return Response.json({
        success: true,
        user: {
          username: user.username,
          phone: user.phone,
          balance: Number(user.balance) || 0,
          vip: Number(user.vip) || 0,
          avatar: user.avatar || '',
          nickname: user.nickname || ''
        },
        transactions,
        vipPurchaseDate
      })
    }

    let tasks = null
    const vipLevel = Number(user.vip) || 0

    if (isWeekdayKampala() && user.vipLocked!== 'true') {
      tasks = await kv.hgetall(getTodayKey(phone))

      if (!tasks) {
        const config = VIP_CONFIG[vipLevel]
        const taskObj = {}
        for (let i = 1; i <= config.books; i++) {
          taskObj[`book${i}`] = 'pending'
        }
        taskObj.income = String(config.books * config.perBook)
        await kv.hset(getTodayKey(phone), taskObj)
        tasks = taskObj
        await kv.hset(`phone:palamedes:${phone}`, 'tasksCompleted', '0')
      }
    }

    return Response.json({
      success: true,
      user: {
        username: user.username,
        phone: user.phone,
        balance: Number(user.balance) || 0,
        vip: vipLevel,
        nickname: user.nickname || '',
        avatar: user.avatar || '',
        bankMTN: user.bankMTN? JSON.parse(user.bankMTN) : null,
        bankAirtel: user.bankAirtel? JSON.parse(user.bankAirtel) : null,
        password: user.password || '',
        vipLocked: user.vipLocked === 'true',
        tasksCompleted: Number(user.tasksCompleted) || 0,
        vipPricePaid: Number(user.vipPricePaid) || 0
      },
      tasks,
      isWeekday: isWeekdayKampala()
    })
  } catch (err) {
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, phone, bookNumber, vipLevel, shareId, field, value, oldPass, newPass } = body
    const cleanPhone = phone?.replace(/\s+/g, '')
    const userKey = `phone:palamedes:${cleanPhone}`

    if (!cleanPhone) return Response.json({ success: false, message: 'Phone required' })

    const user = await kv.hgetall(userKey)
    if (!user ||!user.username) return Response.json({ success: false, message: 'User not found' })

    if (action === 'submitTask') {
      if (!isWeekdayKampala()) {
        return Response.json({ success: false, message: 'No tasks on weekends' })
      }

      const tasks = await kv.hgetall(getTodayKey(cleanPhone))
      const vipLevel = Number(user.vip) || 0
      const perBook = VIP_CONFIG[vipLevel].perBook

      if (!tasks || tasks[`book${bookNumber}`]!== 'pending') {
        return Response.json({ success: false, message: 'Task already submitted or invalid' })
      }

      await kv.hset(getTodayKey(cleanPhone), `book${bookNumber}`, 'submitted')

      const newBalance = Number(user.balance) + perBook
      await kv.hset(userKey, 'balance', String(newBalance))
      await kv.hset(`user:palamedes:${user.username.toLowerCase()}`, 'balance', String(newBalance))

      await kv.lpush(`tx:palamedes:${cleanPhone}`, JSON.stringify({
        type: 'task',
        amount: perBook,
        book: bookNumber,
        date: getKampalaTime(),
        desc: `VIP${vipLevel} Book ${bookNumber}`
      }))

      const updatedTasks = await kv.hgetall(getTodayKey(cleanPhone))
      const totalBooks = VIP_CONFIG[vipLevel].books
      const done = Object.keys(updatedTasks).filter(k => k.startsWith('book') && updatedTasks[k] === 'submitted').length

      if (done === totalBooks) {
        await kv.hset(userKey, 'vipLocked', 'true', 'tasksCompleted', String(done))
        await kv.hset(`user:palamedes:${user.username.toLowerCase()}`, 'vipLocked', 'true', 'tasksCompleted', String(done))
      } else {
        await kv.hset(userKey, 'tasksCompleted', String(done))
      }

      return Response.json({ success: true, balance: newBalance, done, totalBooks })
    }

    if (action === 'buyvip') {
      const currentVip = Number(user.vip) || 0
      const currentPricePaid = Number(user.vipPricePaid) || 0
      const newPrice = VIP_CONFIG[vipLevel].price
      const balance = Number(user.balance) || 0

      if (vipLevel <= currentVip) {
        return Response.json({ success: false, message: 'Cannot downgrade VIP' })
      }

      if (balance < newPrice) {
        return Response.json({ success: false, message: 'Insufficient balance' })
      }

      const refundedBalance = balance + currentPricePaid - newPrice

      await kv.hset(userKey,
        'balance', String(refundedBalance),
        'vip', String(vipLevel),
        'vipPricePaid', String(newPrice),
        'vipLocked', 'false',
        'tasksCompleted', '0'
      )
      await kv.hset(`user:palamedes:${user.username.toLowerCase()}`,
        'balance', String(refundedBalance),
        'vip', String(vipLevel),
        'vipPricePaid', String(newPrice),
        'vipLocked', 'false',
        'tasksCompleted', '0'
      )

      await kv.del(getTodayKey(cleanPhone))
      if (isWeekdayKampala()) {
        const config = VIP_CONFIG[vipLevel]
        const taskObj = {}
        for (let i = 1; i <= config.books; i++) taskObj[`book${i}`] = 'pending'
        taskObj.income = String(config.books * config.perBook)
        await kv.hset(getTodayKey(cleanPhone), taskObj)
      }

      if (currentPricePaid > 0) {
        await kv.lpush(`tx:palamedes:${cleanPhone}`, JSON.stringify({
          type: 'refund',
          amount: currentPricePaid,
          date: getKampalaTime(),
          desc: `VIP${currentVip} refund on upgrade`
        }))
      }
      await kv.lpush(`tx:palamedes:${cleanPhone}`, JSON.stringify({
        type: 'vip',
        amount: -newPrice,
        date: getKampalaTime(),
        desc: `Bought VIP${vipLevel}`
      }))

      return Response.json({
        success: true,
        balance: refundedBalance,
        message: `VIP${vipLevel} activated! Refund: ${currentPricePaid}shs`
      })
    }

    if (action === 'buyShare') {
      const config = SHARE_CONFIG[shareId]
      if (!config) return Response.json({ success: false, message: 'Invalid share' })

      const price = config.price
      const balance = Number(user.balance) || 0

      if (balance < price) {
        return Response.json({ success: false, message: 'Insufficient balance. Need 50,000shs' })
      }

      const existingShare = await kv.hget(`share:palamedes:${cleanPhone}`, shareId)
      if (existingShare) {
        return Response.json({ success: false, message: 'You already own this share' })
      }

      const newBalance = balance - price
      await kv.hset(userKey, 'balance', String(newBalance))
      await kv.hset(`user:palamedes:${user.username.toLowerCase()}`, 'balance', String(newBalance))

      await kv.hset(`share:palamedes:${cleanPhone}`, shareId, JSON.stringify({
        name: config.name,
        price: price,
        daily: config.daily,
        cycle: config.cycle,
        buyDate: getKampalaTime(),
        lastClaim: getKampalaTime()
      }))

      await kv.lpush(`tx:palamedes:${cleanPhone}`, JSON.stringify({
        type: 'share',
        amount: -price,
        date: getKampalaTime(),
        desc: `Bought ${config.name}`
      }))

      return Response.json({ success: true, balance: newBalance, message: `${config.name} purchased!` })
    }

    if (action === 'updateProfile') {
      if (field === 'nickname') {
        if (value.length > 6) return Response.json({ success: false, message: 'Nickname max 6 letters' })
        await kv.hset(userKey, 'nickname', value)
        await kv.hset(`user:palamedes:${user.username.toLowerCase()}`, 'nickname', value)
        return Response.json({ success: true, message: 'Nickname saved' })
      }

      if (field === 'bankMTN') {
        await kv.hset(userKey, 'bankMTN', value)
        await kv.hset(`user:palamedes:${user.username.toLowerCase()}`, 'bankMTN', value)
        return Response.json({ success: true, message: 'MTN bank saved' })
      }

      if (field === 'bankAirtel') {
        await kv.hset(userKey, 'bankAirtel', value)
        await kv.hset(`user:palamedes:${user.username.toLowerCase()}`, 'bankAirtel', value)
        return Response.json({ success: true, message: 'Airtel bank saved' })
      }

      if (field === 'avatar') {
        await kv.hset(userKey, 'avatar', value)
        await kv.hset(`user:palamedes:${user.username.toLowerCase()}`, 'avatar', value)
        return Response.json({ success: true, message: 'Avatar updated' })
      }
    }

    if (action === 'changePassword') {
      if (String(user.password)!== String(oldPass)) {
        return Response.json({ success: false, message: 'Old password incorrect' })
      }
      if (newPass.length < 4) {
        return Response.json({ success: false, message: 'New password too short' })
      }

      await kv.hset(userKey, 'password', newPass)
      await kv.hset(`user:palamedes:${user.username.toLowerCase()}`, 'password', newPass)
      return Response.json({ success: true, message: 'Password changed' })
    }

    return Response.json({ success: false, message: 'Invalid action' })
  } catch (err) {
    console.error('User API error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}