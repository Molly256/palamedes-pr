import { kv } from '@vercel/kv'
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

// GET - Load user's ongoing and expired shares
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    let phone = searchParams.get('phone')

    if (!phone) return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })

    phone = normalizePhone(phone)
    if (!phone) return NextResponse.json({ success: false, message: 'Invalid phone format' }, { status: 400 })

    const sharesKey = `share:palamedes:${phone}`
    console.error('GET DEBUG: Looking for key', sharesKey)

    if ((await kv.type(sharesKey))!== 'hash') {
      console.error('GET DEBUG: Key not found or not hash')
      return NextResponse.json({ success: true, shares: [], expired: [] })
    }

    const sharesHash = await kv.hgetall(sharesKey)
    console.error('GET DEBUG: Raw hash', sharesHash)

    let shares = []
    if (sharesHash) {
      for (const [id, val] of Object.entries(sharesHash)) {
        try {
          if (typeof val === 'string' && val.startsWith('{')) {
            const share = JSON.parse(val)
            if (share.id && share.endDate && share.status) {
              shares.push(share)
            } else {
              await kv.hdel(sharesKey, id)
            }
          } else {
            await kv.hdel(sharesKey, id)
          }
        } catch (e) {
          console.error('GET DEBUG: Error parsing share', id, e)
          await kv.hdel(sharesKey, id)
        }
      }
    }

    const now = getUGNow()
    const updatedShares = await Promise.all(shares.map(async (s) => {
      if (s.status === 'ongoing') {
        const endDate = parseKampalaDate(s.endDate)
        if (endDate &&!isNaN(endDate) && now >= endDate) {
          s.status = 'expired'
          await kv.hset(sharesKey, s.id, JSON.stringify(s))
        }
      }
      return s
    }))

    const ongoing = updatedShares.filter(s => s.status === 'ongoing')
    const expired = updatedShares.filter(s => s.status === 'expired')

    console.error('GET DEBUG: Returning', ongoing.length, 'ongoing,', expired.length, 'expired')
    return NextResponse.json({ success: true, shares: ongoing, expired })
  } catch (err) {
    console.error('GET /api/hot error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

// POST - Buy or collect share
export async function POST(request) {
  console.error('=== POST /api/hot START ===')
  try {
    const body = await request.json()
    console.error('POST DEBUG: Body received', JSON.stringify(body))

    let { action, phone, shareId, shareName, quantity, totalCost, cycleDays, dailyProfit, shareId: collectShareId } = body

    if (!action) return NextResponse.json({ success: false, message: 'Action required' }, { status: 400 })
    if (!phone) return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })

    phone = normalizePhone(phone)
    console.error('POST DEBUG: Normalized phone:', phone)
    if (!phone) return NextResponse.json({ success: false, message: 'Invalid phone format' }, { status: 400 })

    const { user, userKey } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const sharesKey = `share:palamedes:${phone}`
    console.error('POST DEBUG: Using sharesKey:', sharesKey)

    if (action === 'buyShare') {
      const config = SHARE_CONFIG[shareId]
      console.error('POST DEBUG: Config for shareId', shareId, config)

      if (!config) {
        console.error('POST DEBUG: Invalid shareId')
        return NextResponse.json({ success: false, message: 'Invalid share' }, { status: 400 })
      }

      const qty = Number(quantity) || 1
      const cycle = Number(cycleDays) || Number(config.cycle) || 30
      const cost = Number(totalCost) || config.price * qty
      const balance = Number(user.balance) || 0

      console.error('POST DEBUG: Balance', balance, 'Cost', cost, 'Cycle', cycle)

      if (balance < cost) {
        return NextResponse.json({ success: false, message: 'Insufficient balance' }, { status: 400 })
      }

      const newBalance = balance - cost
      await kv.hset(userKey, { balance: String(newBalance) })
      console.error('POST DEBUG: Balance updated to', newBalance)

      const buyDate = getUGNow()
      const endDate = new Date(buyDate)
      endDate.setDate(endDate.getDate() + cycle)

      const expectedProfit = Math.round(config.price * qty * config.daily * cycle)
      const shareIdUnique = `${shareId}_${Date.now()}`

      const shareData = {
        id: shareIdUnique,
        shareId: shareId,
        shareName: shareName || config.name,
        quantity: qty,
        pricePerShare: config.price,
        totalInvested: cost,
        dailyProfit: config.daily * 100,
        cycleDays: cycle,
        expectedProfit: expectedProfit,
        buyDate: formatKampalaDate(buyDate),
        endDate: formatKampalaDate(endDate),
        status: 'ongoing',
        collectedAt: null,
        profitReceived: 0
      }

      const value = JSON.stringify(shareData)
      console.error('POST DEBUG: Saving share. Key:', sharesKey, 'Field:', shareIdUnique, 'Value length:', value.length)

      try {
        const res = await kv.hset(sharesKey, shareIdUnique, value)
        console.error('POST DEBUG: hset result:', res)
      } catch (err) {
        console.error('POST DEBUG: hset FAILED:', err.message, err.stack)
        return NextResponse.json({ success: false, message: err.message }, { status: 500 })
      }

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

      const shareStr = await kv.hget(sharesKey, collectShareId)
      if (!shareStr) return NextResponse.json({ success: false, message: 'Share not found' }, { status: 404 })

      const share = JSON.parse(shareStr)
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