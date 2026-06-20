import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

const TZ = 'Africa/Kampala'
const SHARE_CONFIG = {
  pride: { name: 'PRIDE AND PREJUDICE', price: 50000, daily: 0.01, cycle: 30 },
  hegel: { name: 'Hegel lectures', price: 50000, daily: 0.03, cycle: 120 },
  whale: { name: 'The whale', price: 50000, daily: 0.05, cycle: 180 }
}

function getUGNow() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: TZ }))
}

function formatKampalaDate(date) {
  return new Date(date).toLocaleString('en-GB', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

function parseKampalaDate(str) {
  if (!str) return null
  const match = str.match(/^(\d{2})\/(\d{2})\/(\d{4}), (\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  const [, day, month, year, hour, min, sec] = match
  return new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}`)
}

function normalizePhone(phone) {
  let clean = String(phone).replace('+', '').trim()
  if (clean.startsWith('256')) clean = '0' + clean.slice(3)
  if (!/^0\d{9}$/.test(clean)) return null
  return clean
}

async function getUserData(phone) {
  const res = await db.execute('SELECT * FROM users WHERE phone =?', [phone])
  return res.rows[0] || null
}

async function pushTransaction(phone, tx) {
  await db.execute(
    `INSERT INTO transactions(id, phone, type, amount, status, date, desc)
     VALUES (?,?,?,?,?,?,?)`,
    [tx.id, phone, tx.type, tx.amount, tx.status, tx.date, tx.desc]
  )
}

// GET - Load user's ongoing and expired shares
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    let phone = searchParams.get('phone')

    if (!phone) return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })

    phone = normalizePhone(phone)
    if (!phone) return NextResponse.json({ success: false, message: 'Invalid phone format' }, { status: 400 })

    const res = await db.execute(
      'SELECT * FROM shares WHERE phone =? ORDER BY buyDate DESC',
      [phone]
    )

    let shares = res.rows
    const now = getUGNow()

    // Mark expired shares
    for (let s of shares) {
      if (s.status === 'ongoing') {
        const endDate = parseKampalaDate(s.endDate)
        if (endDate &&!isNaN(endDate) && now >= endDate) {
          await db.execute('UPDATE shares SET status =? WHERE id =?', ['expired', s.id])
          s.status = 'expired'
        }
      }
    }

    const ongoing = shares.filter(s => s.status === 'ongoing')
    const expired = shares.filter(s => s.status === 'expired')

    return NextResponse.json({ success: true, shares: ongoing, expired })
  } catch (err) {
    console.error('GET /api/hot error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

// POST - Buy or collect share
export async function POST(request) {
  try {
    const body = await request.json()
    let { action, phone, shareId, shareName, quantity, totalCost, cycleDays, collectShareId } = body

    if (!action) return NextResponse.json({ success: false, message: 'Action required' }, { status: 400 })
    if (!phone) return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })

    phone = normalizePhone(phone)
    if (!phone) return NextResponse.json({ success: false, message: 'Invalid phone format' }, { status: 400 })

    const user = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    if (action === 'buyShare') {
      const config = SHARE_CONFIG[shareId]
      if (!config) return NextResponse.json({ success: false, message: 'Invalid share' }, { status: 400 })

      const qty = Number(quantity) || 1
      const cycle = Number(cycleDays) || Number(config.cycle) || 30
      const cost = Number(totalCost) || config.price * qty
      const balance = Number(user.balance) || 0

      if (balance < cost) {
        return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 })
      }

      const newBalance = balance - cost
      await db.execute(
        'UPDATE users SET balance =?, available_balance =? WHERE phone =?',
        [String(newBalance), String(newBalance), phone]
      )

      const buyDate = getUGNow()
      const endDate = new Date(buyDate)
      endDate.setDate(endDate.getDate() + cycle)

      const expectedProfit = Math.round(config.price * qty * config.daily * cycle)
      const shareIdUnique = `${shareId}_${Date.now()}`

      await db.execute(
        `INSERT INTO shares(id, phone, shareId, shareName, quantity, pricePerShare, totalInvested,
         dailyProfit, cycleDays, expectedProfit, buyDate, endDate, status, profitReceived)
         VALUES (?,?,?,?, 'ongoing', 0)`,
        [
          shareIdUnique, phone, shareId, shareName || config.name, qty, config.price, cost,
          config.daily * 100, cycle, expectedProfit, formatKampalaDate(buyDate), formatKampalaDate(endDate)
        ]
      )

      await pushTransaction(phone, {
        id: String(Date.now()),
        type: 'share_purchase',
        amount: -cost,
        status: 'success',
        date: new Date().toISOString(),
        desc: `Bought ${qty} x ${shareName || config.name}`
      })

      return NextResponse.json({
        success: true,
        balance: newBalance,
        message: `Bought ${qty} share(s) of ${shareName || config.name}!`
      })
    }

    if (action === 'collectShare') {
      if (!collectShareId) return NextResponse.json({ success: false, message: 'Share ID required' }, { status: 400 })

      const res = await db.execute('SELECT * FROM shares WHERE id =? AND phone =?', [collectShareId, phone])
      const share = res.rows[0]
      if (!share) return NextResponse.json({ success: false, message: 'Share not found' }, { status: 404 })

      if (share.status!== 'ongoing') {
        return NextResponse.json({ success: false, message: 'Share already collected' }, { status: 400 })
      }

      const now = getUGNow()
      const endDate = parseKampalaDate(share.endDate)
      if (!endDate || isNaN(endDate) || now < endDate) {
        return NextResponse.json({ success: false, message: 'Share not matured yet' }, { status: 400 })
      }

      const profit = share.expectedProfit
      const newBalance = Number(user.balance) + profit

      await db.execute(
        'UPDATE shares SET status =?, collectedAt =?, profitReceived =? WHERE id =?',
        ['expired', formatKampalaDate(now), profit, collectShareId]
      )

      await db.execute(
        'UPDATE users SET balance =?, available_balance =? WHERE phone =?',
        [String(newBalance), String(newBalance), phone]
      )

      await pushTransaction(phone, {
        id: String(Date.now()),
        type: 'share_profit',
        amount: profit,
        status: 'success',
        date: new Date().toISOString(),
        desc: `Profit from ${share.shareName} x${share.quantity}`
      })

      return NextResponse.json({ success: true, balance: newBalance, profit, message: 'Profits collected successfully' })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/hot error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}