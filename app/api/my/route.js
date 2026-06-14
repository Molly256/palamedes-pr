import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

const TZ = 'Africa/Kampala'

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')
  if (phone.length === 9 && !phone.startsWith('0')) phone = '0' + phone
  return phone
}

function safeParse(val) {
  if (!val) return null
  try { return typeof val === 'string' ? JSON.parse(val) : val } catch { return null }
}

async function getUserData(phone) {
  const userKey = `user:${phone}`
  if ((await kv.type(userKey)) === 'hash') {
    const user = await kv.hgetall(userKey)
    return { user, userKey }
  }
  return { user: null, userKey: null }
}

async function getVipPurchaseDate(phone) {
  const key = `transactions:${phone}`
  if ((await kv.type(key)) !== 'list') return null
  
  const raw = await kv.lrange(key, 0, 199)
  const tx = raw
    .map(safeParse)
    .filter(Boolean)
    .find(t => t.type === 'viptask_purchase' || t.type === 'vip_purchase')
  
  return tx?.date || tx?.time || tx?.createdAt || null
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    let phone = normalizePhone(searchParams.get('phone'))
    if (!phone) {
      return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    const { user } = await getUserData(phone)
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    }

    const availableBalance = Number(user.balance) || 0
    const createdAt = new Date(user.createdAt || Date.now()).getTime()
    const daysActive = (Date.now() - createdAt) / (1000 * 60 * 60 * 24)
    const jobSecurity = Number(user.vip) >= 3 && daysActive >= 7
    const vipPurchaseDate = await getVipPurchaseDate(phone)

    return NextResponse.json({
      success: true,
      user: {
        username: user.username || '',
        phone: user.phone || phone,
        balance: availableBalance,
        vip: Number(user.vip) || 0,
        avatar: user.avatar || '',
        createdAt: user.createdAt || ''
      },
      availableBalance,
      jobSecurity,
      vipPurchaseDate
    })
  } catch (err) {
    console.error('GET /api/my error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}