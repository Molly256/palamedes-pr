import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

const SHARE_CONFIG = {
  pride: { name: 'PRIDE AND PREJUDICE', price: 50000, daily: 0.01, cycle: 30 },
  hegel: { name: 'Hegel lectures', price: 50000, daily: 0.03, cycle: 120 },
  whale: { name: 'The whale', price: 50000, daily: 0.05, cycle: 180 }
}

function safeParse(val) {
  if (!val || val === '' || val === 'null' || val === 'undefined') return null
  if (typeof val === 'object') return val
  try {
    let parsed = val
    for (let i = 0; i < 2; i++) {
      if (typeof parsed === 'string') parsed = JSON.parse(parsed)
      else break
    }
    return parsed
  } catch { return null }
}

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')
  if (phone.length === 9 &&!phone.startsWith('0')) phone = '0' + phone
  return phone
}

function getUGDateObj() {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' }))
}

function formatKampalaDate(date) {
  return new Date(date).toLocaleString('en-GB', {
    timeZone: 'Africa/Kampala',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

function parseKampalaDate(str) {
  if (!str) return null
  if (str.includes('/')) {
    const [datePart, timePart] = str.split(', ')
    const [day, month, year] = datePart.split('/')
    return new Date(`${year}-${month}-${day}T${timePart}`)
  }
  return new Date(str)
}

async function getUserData(phone) {
  const userKey = `user:${phone}`
  if ((await kv.type(userKey)) === 'hash') {
    const user = await kv.hgetall(userKey)
    return { user, userKey }
  }
  return { user: null, userKey: null }
}

async function pushTransaction(phone, tx) {
  await kv.lpush(`transactions:${phone}`, JSON.stringify(tx))
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = normalizePhone(searchParams.get('phone'))
    if (!phone) return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })

    const sharesKey = `share:palamedes:${phone}`
    if ((await kv.type(sharesKey)) === 'hash') {
      const sharesHash = await kv.hgetall(sharesKey)
      let shares = Object.values(sharesHash || {}).map(s => safeParse(s)).filter(Boolean)

      const now = getUGDateObj()
      shares = shares.map(s => {
        const endDate = parseKampalaDate(s.endDate)
        if (endDate &&!isNaN(endDate) && s.status === 'ongoing' && now >= endDate) {
          s.status = 'expired'
        }
        return s
      })

      const ongoing = shares.filter(s => s.status === 'ongoing')
      const expired = shares.filter(s => s.status === 'expired')

      return NextResponse.json({ success: true, shares: ongoing, expired })
    }
    return NextResponse.json({ success: true, shares: [], expired: [] })
  } catch (err) {
    console.error('GET /api/hot error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    let { action, phone, shareId, shareName, quantity, totalCost, cycleDays, dailyProfit, shareId: collectShareId } = body
    phone = normalizePhone(phone)

    if (!phone) return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })

    const { user, userKey } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const sharesKey = `share:palamedes:${phone}`

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
        buyDate: formatKampalaDate(buyDate),
        endDate: formatKampalaDate(endDate),
        status: 'ongoing',
        collectedAt: null,
        profitReceived: 0
      }

      await kv.hset(sharesKey, shareIdUnique, JSON.stringify(shareData))

      await pushTransaction(phone, {
        id: Date.now(),
        type: 'share_purchase',
        amount: -cost,
        shareName: shareData.shareName,
        quantity: qty,
        date: new Date().toISOString(),
        status: 'success',
        desc: `Bought ${qty} x ${shareData.shareName}`,
        phone: phone
      })

      return NextResponse.json({
        success: true,
        balance: newBalance,
        message: `Bought ${qty} share(s) of ${shareData.shareName}!`
      })
    }

    if (action === 'collectShare') {
      if (!collectShareId) return NextResponse.json({ success: false, message: 'Share ID required' }, { status: 400 })

      if ((await kv.type(sharesKey))!== 'hash') {
        return NextResponse.json({ success: false, message: 'Share not found' }, { status: 404 })
      }

      const shareStr = await kv.hget(sharesKey, collectShareId)
      if (!shareStr) return NextResponse.json({ success: false, message: 'Share not found' }, { status: 404 })

      const share = safeParse(shareStr)
      if (!share) return NextResponse.json({ success: false, message: 'Invalid share data' }, { status: 400 })
      if (share.status!== 'ongoing') {
        return NextResponse.json({ success: false, message: 'Share already collected' }, { status: 400 })
      }

      const now = getUGDateObj()
      const endDate = parseKampalaDate(share.endDate)
      if (!endDate || isNaN(endDate) || now < endDate) {
        return NextResponse.json({ success: false, message: 'Share not matured yet' }, { status: 400 })
      }

      const profit = Math.round(share.pricePerShare * share.quantity * (share.dailyProfit / 100) * share.cycleDays)
      const newBalance = Number(user.balance) + profit

      share.status = 'expired'
      share.collectedAt = formatKampalaDate(now)
      share.profitReceived = profit

      await kv.hset(sharesKey, collectShareId, JSON.stringify(share))
      await kv.hset(userKey, { balance: String(newBalance) })

      await pushTransaction(phone, {
        id: Date.now(),
        type: 'share_profit',
        amount: profit,
        shareName: share.shareName,
        quantity: share.quantity,
        date: new Date().toISOString(),
        status: 'success',
        desc: `Profit from ${share.shareName} x${share.quantity}`,
        phone: phone
      })

      return NextResponse.json({ success: true, balance: newBalance, profit, message: 'Profits collected successfully' })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/hot error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}