import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

const ADMIN_PHONES = ['0753520252', '753520252']
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
  try { return JSON.parse(val) } catch { return null }
}

function getKampalaTime() {
  return new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Kampala',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

function getISOTimestamp() {
  return new Date().toISOString()
}

function isWeekdayKampala() {
  const weekday = new Date().toLocaleDateString('en-US', { timeZone: 'Africa/Kampala', weekday: 'short' })
  return!['Sat', 'Sun'].includes(weekday)
}

function getTodayKey(phone) {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
  return `task:palamedes:${phone}:${today}`
}

function getUGDateObj() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' }))
}

async function getUserData(phone) {
  const cleanPhone = phone.replace(/\D/g, '')
  // Use consistent key format: user:phone:phone
  const newKey = `user:${cleanPhone}:${cleanPhone}`
  const oldKey = `phone:palamedes:${cleanPhone}`

  let user = null
  let userKey = null

  if ((await kv.type(newKey)) === 'hash') {
    user = await kv.hgetall(newKey)
    userKey = newKey
  } else if ((await kv.type(oldKey)) === 'hash') {
    user = await kv.hgetall(oldKey)
    userKey = oldKey
  }

  if ((!user || Object.keys(user).length === 0) &&!userKey) {
    const keys = await kv.keys(`user:*:${cleanPhone}`)
    for (const k of keys) {
      if ((await kv.type(k)) === 'hash') {
        userKey = k
        user = await kv.hgetall(k)
        break
      }
    }
  }

  if (!user || Object.keys(user).length === 0) {
    return { user: null, userKey: null, cleanPhone }
  }

  return { user, userKey, cleanPhone }
}

async function getTransactions(phone) {
  const tx = await kv.lrange(`transactions:${phone}`, 0, 99)
  return tx.map(t => safeParse(t)).filter(Boolean)
}

async function pushTransaction(phone, tx) {
  await kv.lpush(`transactions:${phone}`, JSON.stringify(tx))
}

async function verifyAdmin(phone) {
  const cleanPhone = phone.replace(/\D/g, '')
  return ADMIN_PHONES.includes(cleanPhone)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const action = searchParams.get('action')

    if (!phone && action!== 'pending') {
      return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    if (action === 'pending') {
      if (!await verifyAdmin(phone)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
      }

      const oldKeys = await kv.keys('phone:palamedes:*')
      const newKeys = await kv.keys('user:*')
      const allKeys = [...oldKeys,...newKeys]
      const seenPhones = new Set()
      let deposits = []
      let withdraws = []

      for (let key of allKeys) {
        const type = await kv.type(key)
        if (type!== 'hash') continue

        const parts = key.split(':')
        const userPhone = parts[parts.length - 1]
        if (seenPhones.has(userPhone)) continue
        seenPhones.add(userPhone)

        const txList = await getTransactions(userPhone)
        txList.forEach(tx => {
          if (tx && tx.status === 'pending') {
            tx.phone = userPhone
            if (tx.type === 'deposit') deposits.push(tx)
            if (tx.type === 'withdraw') withdraws.push(tx)
          }
        })
      }

      deposits.sort((a, b) => new Date(b.date) - new Date(a.date))
      withdraws.sort((a, b) => new Date(b.date) - new Date(a.date))

      return NextResponse.json({ success: true, deposits, withdraws })
    }

    if (action === 'getUser') {
      if (!await verifyAdmin(phone)) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
      }
      const { user } = await getUserData(phone)
      if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
      return NextResponse.json({ success: true, user })
    }

    const { user, userKey, cleanPhone } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    if (action === 'getShares') {
      const sharesKey = `share:palamedes:${cleanPhone}`
      if ((await kv.type(sharesKey)) === 'hash') {
        const sharesHash = await kv.hgetall(sharesKey)
        const shares = Object.values(sharesHash || {}).map(s => safeParse(s)).filter(Boolean)
        return NextResponse.json({ success: true, shares })
      }
      return NextResponse.json({ success: true, shares: [] })
    }

    if (action === 'getTransactions') {
      const transactions = await getTransactions(cleanPhone)
      return NextResponse.json({ success: true, transactions })
    }

    if (action === 'getDashboard') {
      const transactions = await getTransactions(cleanPhone)
      const recentTx = transactions.slice(0, 49)
      const vipTx = transactions.find(t => t.type === 'viptask_purchase')
      const vipPurchaseDate = vipTx? vipTx.date : null

      return NextResponse.json({
        success: true,
        user: {
          username: user.username || '',
          phone: user.phone || cleanPhone,
          balance: Number(user.balance) || 0,
          vip: Number(user.vip) || 0,
          avatar: user.avatar || '',
          nickname: user.nickname || '',
          vipLocked: user.vipLocked === 'true',
          tasksCompleted: Number(user.tasksCompleted) || 0,
          vipPricePaid: Number(user.vipPricePaid) || 0,
          bankMTN: safeParse(user.bankMTN),
          bankAirtel: safeParse(user.bankAirtel),
          password: user.password || '',
          referralPaid: user.referralPaid || 'false',
          vip_commission_paid: user.vip_commission_paid || 'false',
          upline1: user.upline1 || '',
          upline2: user.upline2 || '',
          upline3: user.upline3 || ''
        },
        transactions: recentTx,
        vipPurchaseDate
      })
    }

    let tasks = null
    const vipLevel = Number(user.vip) || 0
    const todayKey = getTodayKey(cleanPhone)

    if (isWeekdayKampala() && user.vipLocked!== 'true') {
      if ((await kv.type(todayKey)) === 'hash') {
        tasks = await kv.hgetall(todayKey)
      }

      if (!tasks) {
        const config = VIP_CONFIG[vipLevel]
        if (!config) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

        const taskObj = {}
        for (let i = 1; i <= config.books; i++) {
          taskObj[`book${i}`] = 'pending'
        }
        taskObj.income = String(config.books * config.perBook)
        await kv.hset(todayKey, taskObj)
        tasks = taskObj
        await kv.hset(userKey, { tasksCompleted: '0' })
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        username: user.username || '',
        phone: user.phone || cleanPhone,
        balance: Number(user.balance) || 0,
        vip: vipLevel,
        nickname: user.nickname || '',
        avatar: user.avatar || '',
        bankMTN: safeParse(user.bankMTN),
        bankAirtel: safeParse(user.bankAirtel),
        password: user.password || '',
        vipLocked: user.vipLocked === 'true',
        tasksCompleted: Number(user.tasksCompleted) || 0,
        vipPricePaid: Number(user.vipPricePaid) || 0,
        referralPaid: user.referralPaid || 'false',
        vip_commission_paid: user.vip_commission_paid || 'false',
        upline1: user.upline1 || '',
        upline2: user.upline2 || '',
        upline3: user.upline3 || ''
      },
      tasks,
      isWeekday: isWeekdayKampala()
    })
  } catch (err) {
    console.error('GET /api/user error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, phone, bookNumber, vipLevel: rawVipLevel, shareId, shareName, quantity, totalCost, cycleDays, dailyProfit, field, value, oldPass, newPass, number, method, names, txId, type, amount, newPassword, targetPhone } = body

    if (!phone) return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })

    const { user, userKey, cleanPhone } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const sharesKey = `share:palamedes:${cleanPhone}`
    const vipLevel = Number(rawVipLevel)

    if (action === 'deposit') {
      const amount = Number(value)
      if (!amount || amount <= 0) {
        return NextResponse.json({ success: false, message: 'Invalid deposit amount' }, { status: 400 })
      }

      const tx = {
        id: Date.now(),
        type: 'deposit',
        amount: amount,
        method: method || '',
        date: getISOTimestamp(),
        status: 'pending',
        desc: `Deposit via ${method || 'Mobile Money'}`,
        phone: cleanPhone
      }

      await pushTransaction(cleanPhone, tx)
      return NextResponse.json({ success: true, tx, message: 'Deposit request submitted. Pending approval.' })
    }

    if (action === 'withdraw') {
      const amount = Number(value)
      const balance = Number(user.balance) || 0

      if (!amount || amount <= 0) {
        return NextResponse.json({ success: false, message: 'Invalid withdraw amount' }, { status: 400 })
      }
      if (amount > balance) {
        return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 })
      }

      let savedBank = null
      if (method === 'MTN Mobile money') {
        savedBank = safeParse(user.bankMTN)
      } else if (method === 'Airtel mobile money') {
        savedBank = safeParse(user.bankAirtel)
      }

      if (!savedBank || savedBank.number!== number || savedBank.names!== names) {
        return NextResponse.json({ success: false, message: 'Bank details mismatch. Please update in settings first.' }, { status: 400 })
      }

      const fee = Math.floor(amount * 0.1)
      const netAmount = amount - fee

      const tx = {
        id: Date.now(),
        type: 'withdraw',
        amount: -amount,
        netAmount: netAmount,
        fee: fee,
        method: method || '',
        number: number || '',
        names: names || '',
        date: getISOTimestamp(),
        status: 'pending',
        desc: `Withdraw to ${method} - ${number} - ${names}`,
        phone: cleanPhone
      }

      await pushTransaction(cleanPhone, tx)
      return NextResponse.json({ success: true, tx, message: 'Withdraw request submitted. Pending approval.' })
    }

    if (action === 'submitTask') {
      if (!isWeekdayKampala()) {
        return NextResponse.json({ success: false, message: 'No tasks on weekends' }, { status: 400 })
      }

      const currentVipLevel = Number(user.vip) || 0
      const config = VIP_CONFIG[currentVipLevel]
      if (!config) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

      const bookNum = Number(bookNumber)
      if (!bookNum || bookNum < 1 || bookNum > config.books) {
        return NextResponse.json({ success: false, message: 'Invalid book number for your VIP level' }, { status: 400 })
      }

      const bookKey = `book${bookNum}`
      const todayKey = getTodayKey(cleanPhone)

      let tasks = null
      if ((await kv.type(todayKey)) === 'hash') {
        tasks = await kv.hgetall(todayKey)
      }

      if (!tasks || (tasks[bookKey]!== 'pending' && tasks[bookKey]!== 'read')) {
        return NextResponse.json({ success: false, message: 'Task already submitted or invalid' }, { status: 400 })
      }

      const perBook = Number(config.perBook)
      await kv.hset(todayKey, { [bookKey]: 'submitted' })

      const newBalance = Number(user.balance) + perBook
      await kv.hset(userKey, { balance: String(newBalance) })

      await pushTransaction(cleanPhone, {
        id: Date.now(),
        type: 'task_reward',
        amount: perBook,
        book: bookNum,
        date: getISOTimestamp(),
        status: 'success',
        desc: `VIP${currentVipLevel} Book ${bookNum}`,
        phone: cleanPhone
      })

      let updatedTasks = null
      if ((await kv.type(todayKey)) === 'hash') {
        updatedTasks = await kv.hgetall(todayKey)
      }
      const totalBooks = config.books
      const done = Object.keys(updatedTasks || {}).filter(k => k.startsWith('book') && updatedTasks[k] === 'submitted').length

      if (done === totalBooks) {
        await kv.hset(userKey, { vipLocked: 'true', tasksCompleted: String(done) })
      } else {
        await kv.hset(userKey, { tasksCompleted: String(done) })
      }

      return NextResponse.json({ success: true, balance: Number(newBalance), done: Number(done), totalBooks: Number(totalBooks) })
    }

    if (action === 'buyvip') {
      const currentVip = Number(user.vip) || 0
      const currentPricePaid = Number(user.vipPricePaid) || 0
      const config = VIP_CONFIG[vipLevel]

      if (!config) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

      const newPrice = Number(config.price)
      const balance = Number(user.balance) || 0

      if (!vipLevel || vipLevel <= currentVip) {
        return NextResponse.json({ success: false, message: 'Cannot downgrade VIP' }, { status: 400 })
      }
      if (balance < newPrice) {
        return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 })
      }

      let newBalance = balance - newPrice
      if (currentPricePaid > 0) newBalance += currentPricePaid

      const todayKey = getTodayKey(cleanPhone)
      let oldTasks = null
      if ((await kv.type(todayKey)) === 'hash') {
        oldTasks = await kv.hgetall(todayKey)
      }

      const oldTotalBooks = VIP_CONFIG[currentVip]?.books || 0
      const doneToday = oldTasks? Object.keys(oldTasks).filter(k => k.startsWith('book') && oldTasks[k] === 'submitted').length : 0
      const alreadyFinishedToday = doneToday === oldTotalBooks && oldTotalBooks > 0

      await kv.hset(userKey, {
        balance: String(newBalance),
        vip: String(vipLevel),
        vipPricePaid: String(newPrice),
        vipLocked: 'false',
        tasksCompleted: '0'
      })

      await kv.del(todayKey)

      if (isWeekdayKampala() &&!alreadyFinishedToday) {
        const taskObj = {}
        for (let i = 1; i <= config.books; i++) taskObj[`book${i}`] = 'pending'
        taskObj.income = String(config.books * config.perBook)
        await kv.hset(todayKey, taskObj)
      }

      const timestamp = getISOTimestamp()

      if (currentPricePaid > 0) {
        await pushTransaction(cleanPhone, {
          id: Date.now(),
          type: 'refund',
          amount: currentPricePaid,
          date: timestamp,
          status: 'success',
          desc: `Refund VIP${currentVip} on upgrade to VIP${vipLevel}`,
          phone: cleanPhone
        })
      }

      await pushTransaction(cleanPhone, {
        id: Date.now() + 1,
        type: 'viptask_purchase',
        amount: -newPrice,
        date: timestamp,
        status: 'success',
        desc: `Bought VIP${vipLevel}`,
        phone: cleanPhone
      })

      if (currentVip === 0 && user.referralPaid!== 'true') {
        const paidPrice = Number(config.price)
        const timestamp = getISOTimestamp()

        if (user.upline1) {
          const { user: upline1, userKey: upline1Key } = await getUserData(user.upline1)
          if (upline1) {
            const rewardA = Math.floor(paidPrice * 0.05)
            if (rewardA > 0) {
              await kv.hset(upline1Key, { balance: String(Number(upline1.balance) + rewardA) })
              await pushTransaction(upline1.phone || user.upline1, {
                id: Date.now() + 2,
                type: 'referral_reward',
                amount: rewardA,
                date: timestamp,
                status: 'success',
                desc: `Team A reward from ${user.username || cleanPhone} buying VIP${vipLevel}`,
                phone: upline1.phone || user.upline1
              })
            }
          }
        }

        if (user.upline2) {
          const { user: upline2, userKey: upline2Key } = await getUserData(user.upline2)
          if (upline2) {
            const rewardB = Math.floor(paidPrice * 0.02)
            if (rewardB > 0) {
              await kv.hset(upline2Key, { balance: String(Number(upline2.balance) + rewardB) })
              await pushTransaction(upline2.phone || user.upline2, {
                id: Date.now() + 3,
                type: 'referral_reward',
                amount: rewardB,
                date: timestamp,
                status: 'success',
                desc: `Team B reward from ${user.username || cleanPhone} buying VIP${vipLevel}`,
                phone: upline2.phone || user.upline2
              })
            }
          }
        }

        if (user.upline3) {
          const { user: upline3, userKey: upline3Key } = await getUserData(user.upline3)
          if (upline3) {
            const rewardC = Math.floor(paidPrice * 0.01)
            if (rewardC > 0) {
              await kv.hset(upline3Key, { balance: String(Number(upline3.balance) + rewardC) })
              await pushTransaction(upline3.phone || user.upline3, {
                id: Date.now() + 4,
                type: 'referral_reward',
                amount: rewardC,
                date: timestamp,
                status: 'success',
                desc: `Team C reward from ${user.username || cleanPhone} buying VIP${vipLevel}`,
                phone: upline3.phone || user.upline3
              })
            }
          }
        }

        await kv.hset(userKey, { referralPaid: 'true' })
      }

      let freshUser = null
      if ((await kv.type(userKey)) === 'hash') {
        freshUser = await kv.hgetall(userKey)
      }

      return NextResponse.json({
        success: true,
        user: {
          username: freshUser?.username || '',
          phone: freshUser?.phone || cleanPhone,
          balance: Number(freshUser?.balance) || 0,
          vip: Number(freshUser?.vip) || 0,
          vipPricePaid: Number(freshUser?.vipPricePaid) || 0,
          vipLocked: freshUser?.vipLocked === 'true',
          tasksCompleted: Number(freshUser?.tasksCompleted) || 0,
          nickname: freshUser?.nickname || '',
          avatar: freshUser?.avatar || '',
          bankMTN: safeParse(freshUser?.bankMTN),
          bankAirtel: safeParse(freshUser?.bankAirtel),
          password: freshUser?.password || '',
          referralPaid: freshUser?.referralPaid || 'false',
          vip_commission_paid: freshUser?.vip_commission_paid || 'false',
          upline1: freshUser?.upline1 || '',
          upline2: freshUser?.upline2 || '',
          upline3: freshUser?.upline3 || ''
        },
        message: `VIP${vipLevel} activated! Deducted ${newPrice}shs, refunded ${currentPricePaid}shs`
      })
    }

    if (action === 'buyShare') {
      const config = SHARE_CONFIG[shareId]
      if (!config) return NextResponse.json({ success: false, message: 'Invalid share' }, { status: 400 })

      const qty = Number(quantity) || 1
      const cost = Number(totalCost) || config.price * qty
      const balance = Number(user.balance) || 0

      if (balance < cost) {
        return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 })
      }

      const newBalance = balance - cost
      await kv.hset(userKey, { balance: String(newBalance) })

      const buyDate = getUGDateObj()
      const endDate = new Date(buyDate)
      endDate.setDate(endDate.getDate() + Number(cycleDays || config.cycle))

      const shareIdUnique = `${shareId}_${Date.now()}`
      const shareData = {
        id: shareIdUnique,
        shareId: shareId,
        shareName: shareName || config.name,
        quantity: qty,
        pricePerShare: config.price,
        dailyProfit: Number(dailyProfit || config.daily * 100),
        cycleDays: Number(cycleDays || config.cycle),
        buyDate: getKampalaTime(),
        endDate: getKampalaTime.call(null, endDate),
        status: 'ongoing',
        collectedAt: null,
        profitReceived: 0
      }

      await kv.hset(sharesKey, shareIdUnique, JSON.stringify(shareData))

      await pushTransaction(cleanPhone, {
        id: Date.now(),
        type: 'share_purchase',
        amount: -cost,
        shareName: shareData.shareName,
        quantity: qty,
        date: getISOTimestamp(),
        status: 'success',
        desc: `Bought ${qty} x ${shareData.shareName}`,
        phone: cleanPhone
      })

      return NextResponse.json({ success: true, balance: newBalance, message: `Bought ${qty} share(s) of ${shareData.shareName}!` })
    }

    if (action === 'collectShare') {
      const shareIdUnique = body.shareId
      if (!shareIdUnique) return NextResponse.json({ success: false, message: 'Share ID required' }, { status: 400 })

      if ((await kv.type(sharesKey))!== 'hash') {
        return NextResponse.json({ success: false, message: 'Share not found' }, { status: 404 })
      }

      const shareStr = await kv.hget(sharesKey, shareIdUnique)
      if (!shareStr) return NextResponse.json({ success: false, message: 'Share not found' }, { status: 404 })

      const share = safeParse(shareStr)
      if (!share) return NextResponse.json({ success: false, message: 'Invalid share data' }, { status: 400 })
      if (share.status!== 'ongoing') {
        return NextResponse.json({ success: false, message: 'Share already collected' }, { status: 400 })
      }

      const now = getUGDateObj()
      const endDate = new Date(share.endDate)
      if (now < endDate) {
        return NextResponse.json({ success: false, message: 'Share not matured yet' }, { status: 400 })
      }

      const profit = Math.round(share.pricePerShare * share.quantity * (share.dailyProfit / 100) * share.cycleDays)
      const newBalance = Number(user.balance) + profit

      share.status = 'expired'
      share.collectedAt = getKampalaTime()
      share.profitReceived = profit

      await kv.hset(sharesKey, shareIdUnique, JSON.stringify(share))
      await kv.hset(userKey, { balance: String(newBalance) })

      await pushTransaction(cleanPhone, {
        id: Date.now(),
        type: 'share_profit',
        amount: profit,
        shareName: share.shareName,
        quantity: share.quantity,
        date: getISOTimestamp(),
        status: 'success',
        desc: `Profit from ${share.shareName} x${share.quantity}`,
        phone: cleanPhone
      })

      return NextResponse.json({ success: true, balance: newBalance, profit, message: 'Profits collected successfully' })
    }

    if (action === 'updateProfile') {
      if (field === 'nickname') {
        if (value.length > 6) return NextResponse.json({ success: false, message: 'Nickname max 6 letters' }, { status: 400 })
        await kv.hset(userKey, { nickname: value })
        return NextResponse.json({ success: true, message: 'Nickname saved' })
      }
      if (field === 'bankMTN') {
        await kv.hset(userKey, { bankMTN: JSON.stringify(value) })
        return NextResponse.json({ success: true, message: 'MTN bank saved' })
      }
      if (field === 'bankAirtel') {
        await kv.hset(userKey, { bankAirtel: JSON.stringify(value) })
        return NextResponse.json({ success: true, message: 'Airtel bank saved' })
      }
      if (field === 'avatar') {
        await kv.hset(userKey, { avatar: value })
        return NextResponse.json({ success: true, message: 'Avatar updated' })
      }
    }

    if (action === 'changePassword') {
      if (String(user.password)!== String(oldPass)) {
        return NextResponse.json({ success: false, message: 'Old password incorrect' }, { status: 400 })
      }
      if (newPass.length < 6) {
        return NextResponse.json({ success: false, message: 'New password must be at least 6 characters' }, { status: 400 })
      }
      await kv.hset(userKey, { password: newPass })
      return NextResponse.json({ success: true, message: 'Password changed' })
    }

    if (action === 'resetPassword') {
      if (!await verifyAdmin(phone)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
      if (!targetPhone) return NextResponse.json({ success: false, message: 'Target phone required' }, { status: 400 })

      const cleanTarget = targetPhone.replace(/\D/g, '')
      const { userKey: targetKey } = await getUserData(cleanTarget)
      if (!targetKey) return NextResponse.json({ success: false, message: 'Target user not found' }, { status: 404 })

      await kv.hset(targetKey, { password: newPassword })
      return NextResponse.json({ success: true, message: 'Password reset successfully' })
    }

    if (action === 'approve' || action === 'reject') {
      if (!await verifyAdmin(phone)) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
      if (!targetPhone) return NextResponse.json({ success: false, message: 'Target phone required' }, { status: 400 })

      const userPhone = targetPhone.replace(/\D/g, '')
      const txList = await getTransactions(userPhone)
      const txIndex = txList.findIndex(t => t.id == txId)

      if (txIndex === -1) return NextResponse.json({ success: false, message: 'Transaction not found' })

      const tx = txList[txIndex]

      if (action === 'approve') {
        tx.status = 'success'

        if (type === 'deposit') {
          const { user: targetUser, userKey: targetKey } = await getUserData(userPhone)
          if (targetKey) {
            const newBalance = Number(targetUser.balance || 0) + Number(tx.amount)
            await kv.hset(targetKey, { balance: String(newBalance) })
          }
        }

        if (type === 'withdraw') {
          const { user: targetUser, userKey: targetKey } = await getUserData(userPhone)
          if (targetKey) {
            const newBalance = Number(targetUser.balance || 0) + Number(tx.amount)
            await kv.hset(targetKey, { balance: String(newBalance) })
          }
        }
      } else {
        tx.status = 'rejected'
      }

      // Update transaction in list - inefficient but works for admin panel
      const rawList = await kv.lrange(`transactions:${userPhone}`, 0, 99)
      rawList[txIndex] = JSON.stringify(tx)
      await kv.del(`transactions:${userPhone}`)
      if (rawList.length > 0) {
        await kv.lpush(`transactions:${userPhone}`,...rawList.reverse())
      }

      return NextResponse.json({ success: true, message: `Transaction ${action}d` })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/user error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}