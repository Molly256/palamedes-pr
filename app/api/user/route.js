import { kv } from '@vercel/kv'

const ADMIN_PHONE = '2567xxxxxxxx' // must match dashboard
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
  const newKey = `user:${cleanPhone}`
  const oldKey = `phone:palamedes:${cleanPhone}`

  let user = await kv.hgetall(newKey)
  let userKey = newKey

  if (!user ||!user.username) {
    user = await kv.hgetall(oldKey)
    userKey = oldKey
  }

  return { user, userKey, cleanPhone }
}

async function verifyAdmin(phone) {
  const cleanPhone = phone.replace(/\D/g, '')
  return cleanPhone === ADMIN_PHONE
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const action = searchParams.get('action')

    if (!phone && action!== 'pending') {
      return Response.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    // Admin: get pending deposits and withdraws
    if (action === 'pending') {
      const allPhones = await kv.keys('phone:palamedes:*')
      let deposits = []
      let withdraws = []

      for (let key of allPhones) {
        const userPhone = key.split(':')[2]
        const txList = await kv.lrange(`transactions:${userPhone}`, 0, 99)
        txList.forEach(txStr => {
          const tx = safeParse(txStr)
          if (tx && tx.status === 'pending') {
            tx.phone = userPhone
            if (tx.type === 'deposit') deposits.push(tx)
            if (tx.type === 'withdraw') withdraws.push(tx)
          }
        })
      }

      deposits.sort((a, b) => new Date(b.date) - new Date(a.date))
      withdraws.sort((a, b) => new Date(b.date) - new Date(a.date))

      return Response.json({ success: true, deposits, withdraws })
    }

    // Admin: get single user
    if (action === 'getUser') {
      const { user } = await getUserData(phone)
      if (!user ||!user.username) {
        return Response.json({ success: false, message: 'User not found' }, { status: 404 })
      }
      return Response.json({ success: true, user })
    }

    const { user, userKey, cleanPhone } = await getUserData(phone)
    if (!user ||!user.username) return Response.json({ success: false, message: 'User not found' }, { status: 404 })

    if (action === 'getShares') {
      const sharesHash = await kv.hgetall(`share:palamedes:${cleanPhone}`)
      const shares = Object.values(sharesHash || {}).map(s => safeParse(s)).filter(Boolean)
      return Response.json({ success: true, shares })
    }

    if (action === 'getTransactions') {
      const txList = await kv.lrange(`transactions:${cleanPhone}`, 0, 99)
      const transactions = txList.map(t => safeParse(t)).filter(Boolean)
      return Response.json({ success: true, transactions })
    }

    if (action === 'getDashboard') {
      const txList = await kv.lrange(`transactions:${cleanPhone}`, 0, 49)
      const transactions = txList.map(t => safeParse(t)).filter(Boolean)

      const vipTx = transactions.find(t => t.type === 'viptask_purchase')
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
          password: user.password || '',
          referralPaid: user.referralPaid || 'false',
          upline1: user.upline1 || '',
          upline2: user.upline2 || '',
          upline3: user.upline3 || ''
        },
        transactions,
        vipPurchaseDate
      })
    }

    let tasks = null
    const vipLevel = Number(user.vip) || 0

    if (isWeekdayKampala() && user.vipLocked!== 'true') {
      tasks = await kv.hgetall(getTodayKey(cleanPhone))

      if (!tasks) {
        const config = VIP_CONFIG[vipLevel]
        if (!config) return Response.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

        const taskObj = {}
        for (let i = 1; i <= config.books; i++) {
          taskObj[`book${i}`] = 'pending'
        }
        taskObj.income = String(config.books * config.perBook)
        await kv.hset(getTodayKey(cleanPhone), taskObj)
        tasks = taskObj
        await kv.hset(userKey, { tasksCompleted: '0' })
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
        vipPricePaid: Number(user.vipPricePaid) || 0,
        referralPaid: user.referralPaid || 'false',
        upline1: user.upline1 || '',
        upline2: user.upline2 || '',
        upline3: user.upline3 || ''
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
    const { action, phone, bookNumber, vipLevel: rawVipLevel, shareId, shareName, quantity, totalCost, cycleDays, dailyProfit, field, value, oldPass, newPass, number, method, names, txId, type, amount, newPassword, targetPhone } = body

    if (!phone) return Response.json({ success: false, message: 'Phone required' }, { status: 400 })

    const { user, userKey, cleanPhone } = await getUserData(phone)
    if (!user ||!user.username) return Response.json({ success: false, message: 'User not found' }, { status: 404 })

    const sharesKey = `share:palamedes:${cleanPhone}`
    const vipLevel = Number(rawVipLevel)

    if (action === 'deposit') {
      const amount = Number(value)
      if (!amount || amount <= 0) {
        return Response.json({ success: false, message: 'Invalid deposit amount' }, { status: 400 })
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

      await kv.lpush(`transactions:${cleanPhone}`, JSON.stringify(tx))

      return Response.json({
        success: true,
        tx: tx,
        message: 'Deposit request submitted. Pending approval.'
      })
    }

    if (action === 'withdraw') {
      const amount = Number(value)
      const balance = Number(user.balance) || 0

      if (!amount || amount <= 0) {
        return Response.json({ success: false, message: 'Invalid withdraw amount' }, { status: 400 })
      }
      if (amount > balance) {
        return Response.json({ success: false, message: 'Insufficient balance' }, { status: 400 })
      }

      let savedBank = null
      if (method === 'MTN Mobile money') {
        savedBank = safeParse(user.bankMTN)
      } else if (method === 'Airtel mobile money') {
        savedBank = safeParse(user.bankAirtel)
      }

      if (!savedBank || savedBank.number!== number || savedBank.names!== names) {
        return Response.json({
          success: false,
          message: 'Bank details mismatch. Please update in settings first.'
        }, { status: 400 })
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

      await kv.lpush(`transactions:${cleanPhone}`, JSON.stringify(tx))

      return Response.json({
        success: true,
        tx: tx,
        message: 'Withdraw request submitted. Pending approval.'
      })
    }

    if (action === 'submitTask') {
      if (!isWeekdayKampala()) {
        return Response.json({ success: false, message: 'No tasks on weekends' }, { status: 400 })
      }

      const currentVipLevel = Number(user.vip) || 0
      const config = VIP_CONFIG[currentVipLevel]
      if (!config) return Response.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

      const bookNum = Number(bookNumber)
      if (!bookNum || bookNum < 1 || bookNum > config.books) {
        return Response.json({ success: false, message: 'Invalid book number for your VIP level' }, { status: 400 })
      }

      const bookKey = `book${bookNum}`
      const todayKey = getTodayKey(cleanPhone)
      const tasks = await kv.hgetall(todayKey)

      if (!tasks || (tasks[bookKey]!== 'pending' && tasks[bookKey]!== 'read')) {
        return Response.json({ success: false, message: 'Task already submitted or invalid' }, { status: 400 })
      }

      const perBook = Number(config.perBook)
      await kv.hset(todayKey, { [bookKey]: 'submitted' })

      const newBalance = Number(user.balance) + perBook
      await kv.hset(userKey, { balance: String(newBalance) })

      await kv.lpush(`transactions:${cleanPhone}`, JSON.stringify({
        id: Date.now(),
        type: 'task_reward',
        amount: perBook,
        book: bookNum,
        date: getISOTimestamp(),
        status: 'success',
        desc: `VIP${currentVipLevel} Book ${bookNum}`,
        phone: cleanPhone
      }))

      const updatedTasks = await kv.hgetall(todayKey)
      const totalBooks = config.books
      const done = Object.keys(updatedTasks || {}).filter(k => k.startsWith('book') && updatedTasks[k] === 'submitted').length

      if (done === totalBooks) {
        await kv.hset(userKey, { vipLocked: 'true', tasksCompleted: String(done) })
      } else {
        await kv.hset(userKey, { tasksCompleted: String(done) })
      }

      return Response.json({
        success: true,
        balance: Number(newBalance),
        done: Number(done),
        totalBooks: Number(totalBooks)
      })
    }

    if (action === 'buyvip') {
      const currentVip = Number(user.vip) || 0
      const currentPricePaid = Number(user.vipPricePaid) || 0
      const config = VIP_CONFIG[vipLevel]

      if (!config) return Response.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

      const newPrice = Number(config.price)
      const balance = Number(user.balance) || 0

      if (!vipLevel || vipLevel <= currentVip) {
        return Response.json({ success: false, message: 'Cannot downgrade VIP' }, { status: 400 })
      }

      if (balance < newPrice) {
        return Response.json({ success: false, message: 'Insufficient balance' }, { status: 400 })
      }

      let newBalance = balance - newPrice
      if (currentPricePaid > 0) {
        newBalance += currentPricePaid
      }

      const todayKey = getTodayKey(cleanPhone)
      const oldTasks = await kv.hgetall(todayKey)
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
        await kv.lpush(`transactions:${cleanPhone}`, JSON.stringify({
          id: Date.now(),
          type: 'refund',
          amount: currentPricePaid,
          date: timestamp,
          status: 'success',
          desc: `Refund VIP${currentVip} on upgrade to VIP${vipLevel}`,
          phone: cleanPhone
        }))
      }

      await kv.lpush(`transactions:${cleanPhone}`, JSON.stringify({
        id: Date.now(),
        type: 'viptask_purchase',
        amount: -newPrice,
        date: timestamp,
        status: 'success',
        desc: `Bought VIP${vipLevel}`,
        phone: cleanPhone
      }))

      if (currentVip === 0 && user.referralPaid!== 'true') {
        const paidPrice = Number(config.price)

        if (user.upline1) {
          const { user: upline1, userKey: upline1Key } = await getUserData(user.upline1)
          if (upline1 && upline1.username) {
            const rewardA = Math.floor(paidPrice * 0.05)
            if (rewardA > 0) {
              await kv.hset(upline1Key, { balance: String(Number(upline1.balance) + rewardA) })
              await kv.lpush(`transactions:${upline1.phone}`, JSON.stringify({
                id: Date.now(),
                type: 'referral_reward',
                amount: rewardA,
                date: timestamp,
                status: 'success',
                desc: `Team A reward from ${user.username} buying VIP${vipLevel}`,
                phone: upline1.phone
              }))
            }
          }
        }

        if (user.upline2) {
          const { user: upline2, userKey: upline2Key } = await getUserData(user.upline2)
          if (upline2 && upline2.username) {
            const rewardB = Math.floor(paidPrice * 0.02)
            if (rewardB > 0) {
              await kv.hset(upline2Key, { balance: String(Number(upline2.balance) + rewardB) })
              await kv.lpush(`transactions:${upline2.phone}`, JSON.stringify({
                id: Date.now(),
                type: 'referral_reward',
                amount: rewardB,
                date: timestamp,
                status: 'success',
                desc: `Team B reward from ${user.username} buying VIP${vipLevel}`,
                phone: upline2.phone
              }))
            }
          }
        }

        if (user.upline3) {
          const { user: upline3, userKey: upline3Key } = await getUserData(user.upline3)
          if (upline3 && upline3.username) {
            const rewardC = Math.floor(paidPrice * 0.01)
            if (rewardC > 0) {
              await kv.hset(upline3Key, { balance: String(Number(upline3.balance) + rewardC) })
              await kv.lpush(`transactions:${upline3.phone}`, JSON.stringify({
                id: Date.now(),
                type: 'referral_reward',
                amount: rewardC,
                date: timestamp,
                status: 'success',
                desc: `Team C reward from ${user.username} buying VIP${vipLevel}`,
                phone: upline3.phone
              }))
            }
          }
        }

        await kv.hset(userKey, { referralPaid: 'true' })
      }

      const freshUser = await kv.hgetall(userKey)
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
          password: freshUser.password || '',
          referralPaid: freshUser.referralPaid || 'false',
          upline1: freshUser.upline1 || '',
          upline2: freshUser.upline2 || '',
          upline3: freshUser.upline3 || ''
        },
        message: `VIP${vipLevel} activated! Deducted ${newPrice}shs, refunded ${currentPricePaid}shs`
      })
    }

    if (action === 'buyShare') {
      const config = SHARE_CONFIG[shareId]
      if (!config) return Response.json({ success: false, message: 'Invalid share' }, { status: 400 })

      const qty = Number(quantity) || 1
      const cost = Number(totalCost) || config.price * qty
      const balance = Number(user.balance) || 0

      if (balance < cost) {
        return Response.json({ success: false, message: 'Insufficient balance' }, { status: 400 })
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

      await kv.lpush(`transactions:${cleanPhone}`, JSON.stringify({
        id: Date.now(),
        type: 'share_purchase',
        amount: -cost,
        shareName: shareData.shareName,
        quantity: qty,
        date: getISOTimestamp(),
        status: 'success',
        desc: `Bought ${qty} x ${shareData.shareName}`,
        phone: cleanPhone
      }))

      return Response.json({
        success: true,
        balance: newBalance,
        message: `Bought ${qty} share(s) of ${shareData.shareName}!`
      })
    }

    if (action === 'collectShare') {
      const shareIdUnique = body.shareId
      if (!shareIdUnique) return Response.json({ success: false, message: 'Share ID required' }, { status: 400 })

      const shareStr = await kv.hget(sharesKey, shareIdUnique)
      if (!shareStr) return Response.json({ success: false, message: 'Share not found' }, { status: 404 })

      const share = safeParse(shareStr)
      if (!share) return Response.json({ success: false, message: 'Invalid share data' }, { status: 400 })

      if (share.status!== 'ongoing') {
        return Response.json({ success: false, message: 'Share already collected' }, { status: 400 })
      }

      const now = getUGDateObj()
      const endDate = new Date(share.endDate)
      if (now < endDate) {
        return Response.json({ success: false, message: 'Share not matured yet' }, { status: 400 })
      }

      const profit = Math.round(share.pricePerShare * share.quantity * (share.dailyProfit / 100) * share.cycleDays)
      const newBalance = Number(user.balance) + profit

      share.status = 'expired'
      share.collectedAt = getKampalaTime()
      share.profitReceived = profit

      await kv.hset(sharesKey, shareIdUnique, JSON.stringify(share))
      await kv.hset(userKey, { balance: String(newBalance) })

      await kv.lpush(`transactions:${cleanPhone}`, JSON.stringify({
        id: Date.now(),
        type: 'share_profit',
        amount: profit,
        shareName: share.shareName,
        quantity: share.quantity,
        date: getISOTimestamp(),
        status: 'success',
        desc: `Profit from ${share.shareName} x${share.quantity}`,
        phone: cleanPhone
      }))

      return Response.json({
        success: true,
        balance: newBalance,
        profit: profit,
        message: 'Profits collected successfully'
      })
    }

    if (action === 'updateProfile') {
      if (field === 'nickname') {
        if (value.length > 6) return Response.json({ success: false, message: 'Nickname max 6 letters' }, { status: 400 })
        await kv.hset(userKey, { nickname: value })
        return Response.json({ success: true, message: 'Nickname saved' })
      }

      if (field === 'bankMTN') {
        await kv.hset(userKey, { bankMTN: JSON.stringify(value) })
        return Response.json({ success: true, message: 'MTN bank saved' })
      }

      if (field === 'bankAirtel') {
        await kv.hset(userKey, { bankAirtel: JSON.stringify(value) })
        return Response.json({ success: true, message: 'Airtel bank saved' })
      }

      if (field === 'avatar') {
        await kv.hset(userKey, { avatar: value })
        return Response.json({ success: true, message: 'Avatar updated' })
      }
    }

    if (action === 'changePassword') {
      if (String(user.password)!== String(oldPass)) {
        return Response.json({ success: false, message: 'Old password incorrect' }, { status: 400 })
      }
      if (newPass.length < 6) {
        return Response.json({ success: false, message: 'New password must be at least 6 characters' }, { status: 400 })
      }

      await kv.hset(userKey, { password: newPass })
      return Response.json({ success: true, message: 'Password changed' })
    }

    // Admin actions
    if (action === 'resetPassword') {
      const isAdmin = await verifyAdmin(phone)
      if (!isAdmin) return Response.json({ success: false, message: 'Unauthorized' }, { status: 403 })

      if (!targetPhone) return Response.json({ success: false, message: 'Target phone required' }, { status: 400 })

      const cleanTarget = targetPhone.replace(/\D/g, '')
      await kv.hset(`phone:palamedes:${cleanTarget}`, { password: newPassword })
      return Response.json({ success: true, message: 'Password reset successfully' })
    }

    if (action === 'approve' || action === 'reject') {
      const isAdmin = await verifyAdmin(phone)
      if (!isAdmin) return Response.json({ success: false, message: 'Unauthorized' }, { status: 403 })

      if (!targetPhone) return Response.json({ success: false, message: 'Target phone required' }, { status: 400 })

      const userPhone = targetPhone.replace(/\D/g, '')
      const txList = await kv.lrange(`transactions:${userPhone}`, 0, 99)
      const txIndex = txList.findIndex(t => safeParse(t)?.id == txId)

      if (txIndex === -1) return Response.json({ success: false, message: 'Transaction not found' })

      const tx = safeParse(txList[txIndex])
      if (!tx) return Response.json({ success: false, message: 'Invalid transaction data' })

      if (action === 'approve') {
        tx.status = 'success'

        if (type === 'deposit') {
          const { user: targetUser, userKey: targetKey } = await getUserData(userPhone)
          const newBalance = Number(targetUser.balance || 0) + Number(tx.amount)
          await kv.hset(targetKey, { balance: String(newBalance) })
        }

        if (type === 'withdraw') {
          const { user: targetUser, userKey: targetKey } = await getUserData(userPhone)
          const newBalance = Number(targetUser.balance || 0) - Number(tx.amount)
          await kv.hset(targetKey, { balance: String(newBalance) })
        }
      } else {
        tx.status = 'rejected'
      }

      txList[txIndex] = JSON.stringify(tx)
      await kv.lset(`transactions:${userPhone}`, txIndex, JSON.stringify(tx))

      return Response.json({ success: true, message: `Transaction ${action}d` })
    }

    return Response.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/user error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}