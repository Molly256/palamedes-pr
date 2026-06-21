import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()
const TZ = 'Africa/Kampala'

function normalizePhone(phone) {
  if (!phone) return ''
  phone = String(phone).replace(/\D/g, '')

  // Only accept 07XXXXXXXX
  if (!/^07\d{8}$/.test(phone)) {
    return ''
  }
  return phone
}

async function getUserData(phone) {
  const user = await redis.hgetall(`user:${phone}`)
  return { user: user && Object.keys(user).length > 0 ? user : null }
}

async function getVipPurchaseInfo(phone) {
  const txList = await redis.lrange(`tx:${phone}`, 0, 99) // check last 100 tx
  let latestVipTx = null

  for (const txStr of txList) {
    const tx = JSON.parse(txStr)
    if (tx.type === 'viptask_purchase' || tx.type === 'vip_purchase') {
      latestVipTx = tx
      break
    }
  }

  return {
    date: latestVipTx?.date || null,
    amount: Number(latestVipTx?.amount) || 0
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = normalizePhone(searchParams.get('phone'))

    if (!phone) {
      return NextResponse.json({
        success: false,
        message: 'Phone must be 10 digits starting with 07'
      }, { status: 400 })
    }

    const { user } = await getUserData(phone)
    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      }, { status: 404 })
    }

    const { date: vipPurchaseDate, amount: vipPurchaseAmount } = await getVipPurchaseInfo(phone)

    return NextResponse.json({
      success: true,
      user: {
        username: user.username || '',
        phone: user.phone || phone,
        balance: Number(user.balance) || 0,
        vip: Number(user.vip) || 0,
        avatar: user.avatar || '',
        createdAt: user.createdAt || user.regDate || ''
      },
      jobSecurity: true,
      vipPurchaseDate,
      vipPurchaseAmount
    })
  } catch (err) {
    console.error('GET /api/my error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}