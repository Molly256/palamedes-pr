import { kv } from '@vercel/kv'

const VIP_CONFIG = {
 0: { price: 0, books: 4, perBook: 625 },
 1: { price: 80000, books: 4, perBook: 625 },
 2: { price: 250000, books: 4, perBook: 2000 },
 3: { price: 790000, books: 4, perBook: 6500 },
 4: { price: 1000000, books: 5, perBook: 7000 },
 5: { price: 1500000, books: 5, perBook: 10000 },
 6: { price: 2100000, books: 5, perBook: 14000 },
 7: { price: 4000000, books: 5, perBook: 28000 },
 8: { price: 4600000, books: 5, perBook: 32000 },
 9: { price: 5000000, books: 5, perBook: 40000 },
 10: { price: 8000000, books: 5, perBook: 60000 },
}

const SHARE_CONFIG = {
  pride: { name: 'PRIDE AND PREJUDICE', price: 50000, daily: 0.01, cycle: 30 },
  hegel: { name: 'Hegel lectures', price: 50000, daily: 0.03, cycle: 120 },
  whale: { name: 'The whale', price: 50000, daily: 0.05, cycle: 180 }
}

function safeParse(val) {
  if (!val || val === '' || val === 'null' || val === 'undefined') return null
  try {
    return JSON.parse(val)
  } catch {
    return null
  }
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
        parsedShares[id] = safeParse(data)
      }
      return Response.json({ success: true, shares: parsedShares })
    }

    if (action === 'getDashboard') {
      const txList = await kv.lrange(`transactions:${phone}`, 0, 49)
      const transactions = txList.map(t => safeParse(t)).filter(Boolean)

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
          nickname: user.nickname || '',
          vipLocked: user.vipLocked === 'true',
          tasksCompleted: Number(user.tasksCompleted) || 0,
          vipPricePaid: Number(user.vipPricePaid) || 0,
          bankMTN: safeParse(user.bankMTN),
          bankAirtel: safeParse(user.bankAirtel),
          password: user.password || ''
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
        if (!config) return Response.json({ success: false, message: 'Invalid VIP level' })

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
        bankMTN: safeParse(user.bankMTN),
        bankAirtel: safeParse(user.bankAirtel),
        password: user.password || '',
        vipLocked: user.vipLocked === 'true',
        tasksCompleted: Number(user.tasksCompleted) || 0,
        vipPricePaid: Number(user.vipPricePaid) || 0
      },
      tasks,
      isWeekday: isWeekdayKampala()
    })
  } catch (err) {
    console.error('GET /api/user error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, phone, bookNumber, vipLevel: rawVipLevel, shareId, field, value, oldPass, newPass } = body
    const cleanPhone = phone?.replace(/\s+/g, '')
    const userKey = `phone:palamedes:${cleanPhone}`
    const vipLevel = Number(rawVipLevel)

    if (!cleanPhone) return Response.json({ success: false, message: 'Phone required' })

    const user = await kv.hgetall(userKey)
    if (!user ||!user.username) return Response.json({ success: false, message: 'User not found' })

    if (action === 'submitTask') {
      if (!isWeekdayKampala()) {
        return Response.json({ success: false, message: 'No tasks on weekends' })
      }

      const currentVipLevel = Number(user.vip) || 0
      const config = VIP_CONFIG[currentVipLevel]
      if (!config) return Response.json({ success: false, message: 'Invalid VIP level' })

      const tasks = await kv.hgetall(getTodayKey(cleanPhone))
      const perBook = Number(config.perBook)

      if (!tasks || tasks[`book${bookNumber}`]!== 'pending') {
        return Response.json({ success: false, message: 'Task already submitted or invalid' })
      }

      await kv.hset(getTodayKey(cleanPhone), `book${bookNumber}`, 'submitted')

      const newBalance = Number(user.balance) + perBook
      await kv.hset(userKey, 'balance', String(newBalance))
      await kv.hset(`user:palamedes:${user.username.toLowerCase()}`, 'balance', String(newBalance))

      await kv.lpush(`transactions:${cleanPhone}`, JSON.stringify({
        type: 'task',
        amount: perBook,
        book: bookNumber,
        date: getKampalaTime(),
        desc: `VIP${currentVipLevel} Book ${bookNumber}`
      }))

      const updatedTasks = await kv.hgetall(getTodayKey(cleanPhone))
      const totalBooks = config.books
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
      try {
        const currentVip = Number(user.vip) || 0
        const currentPricePaid = Number(user.vipPricePaid) || 0
        const config = VIP_CONFIG[vipLevel]

        if (!config) {
          return Response.json({ success: false, message: 'Invalid VIP level' })
        }

        const newPrice = Number(config.price)
        const balance = Number(user.balance) || 0

        if (!vipLevel || vipLevel <= currentVip) {
          return Response.json({ success: false, message: 'Cannot downgrade VIP' })
        }

        if (balance < newPrice) {
          return Response.json({ success: false, message: 'Insufficient balance' })
        }

        let newBalance = balance - newPrice
        if (currentPricePaid > 0) {
          newBalance += currentPricePaid
        }

        const todayKey = getTodayKey(cleanPhone)
        const oldTasks = await kv.hgetall(todayKey)
        const oldTotalBooks = VIP_CONFIG[currentVip]?.books || 0
        const doneToday = oldTasks
       ? Object.keys(oldTasks).filter(k => k.startsWith('book') && oldTasks[k] === 'submitted').length
          : 0
        const alreadyFinishedToday = doneToday === oldTotalBooks && oldTotalBooks > 0

        // Update user hash
        await kv.hset(userKey,
          'balance', String(newBalance),
          'vip', String(vipLevel),
          'vipPricePaid', String(newPrice),
          'vipLocked', 'false',
          'tasksCompleted', '0'
        )

        // Update username hash
        await kv.hset(`user:palamedes:${user.username.toLowerCase()}`,
          'balance', String(newBalance),
          'vip', String(vipLevel),
          'vipPricePaid', String(newPrice),
          'vipLocked', 'false',
          'tasksCompleted', '0'
        )

        await kv.del(todayKey)

        if (isWeekdayKampala() &&!alreadyFinishedToday) {
          const taskObj = {}
          for (let i = 1; i <= config.books; i++) taskObj[`book${i}`] = 'pending'
          taskObj.income = String(config.books * config.perBook)
          await kv.hset(todayKey, taskObj)
        }

        const timestamp = getKampalaTime()
        if (currentPricePaid > 0) {
          await kv.lpush(`transactions:${cleanPhone}`, JSON.stringify({
            type: 'refund',
            amount: currentPricePaid,
            date: timestamp,
            desc: `Refund VIP${currentVip} on upgrade to VIP${vipLevel}`
          }))
        }

        await kv.lpush(`transactions:${cleanPhone}`, JSON.stringify({
          type: 'vip',
          amount: -newPrice,
          date: timestamp,
          desc: `Bought VIP${vipLevel}`
        }))

        // Wait for KV consistency then read back
        await new Promise(r => setTimeout(r, 100))
        const freshUser = await kv.hgetall(userKey)

        if (!freshUser || freshUser.balance == null) {
          return Response.json({ success: false, message: 'Failed to update user data' }, { status: 500 })
        }

        return Response.json({
          success: true,
          user: {
            username: freshUser.username,
            phone: freshUser.phone,
            balance: Number(freshUser.balance) || 0,
            vip: Number(freshUser.vip) || 0,
            vipPricePaid: Number(freshUser.vipPricePaid) || 0,
            vipLocked: freshUser.vipLocked === 'true',
            tasksCompleted: Number(freshUser.tasksCompleted) || 0,
            nickname: freshUser.nickname || '',
            avatar: freshUser.avatar || '',
            bankMTN: safeParse(freshUser.bankMTN),
            bankAirtel: safeParse(freshUser.bankAirtel),
            password: freshUser.password || ''
          },
          message: `VIP${vipLevel} activated! Deducted ${newPrice}shs, refunded ${currentPricePaid}shs`
        })

      } catch (err) {
        console.error('buyvip error:', err)
        return Response.json({ success: false, message: err.message }, { status: 500 })
      }
    }

    if (action === 'buyShare') {
      const config = SHARE_CONFIG[shareId]
      if (!config) return Response.json({ success: false, message: 'Invalid share' })

      const price = Number(config.price)
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

      await kv.lpush(`transactions:${cleanPhone}`, JSON.stringify({
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
    console.error('POST /api/user error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}