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
  return `task:${phone}:${today}`
}

function getUGDateObj() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' }))
}

async function getUserData(phone) {
  const cleanPhone = phone.replace(/\D/g, '')
  const userKey = `user:${cleanPhone}`

  if ((await kv.type(userKey)) === 'hash') {
    const user = await kv.hgetall(userKey)
    return { user, userKey, cleanPhone }
  }

  return { user: null, userKey: null, cleanPhone }
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

      const keys = await kv.keys('user:*')
      let deposits = []
      let withdraws = []

      for (let key of keys) {
        if ((await kv.type(key))!== 'hash') continue
        const userPhone = key.split(':')[1]

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
      const sharesKey = `share:${cleanPhone}`
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

    const sharesKey = `share:${cleanPhone}`
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

    //... rest of your POST actions stay the same, they already use userKey and cleanPhone correctly now
    // Keep all your existing submitTask, buyvip, buyShare, collectShare, updateProfile, changePassword, resetPassword, approve/reject code here

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

    // Paste your remaining actions here unchanged - buyvip, buyShare, collectShare, etc.
    // They will now work because userKey is correct

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/user error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}