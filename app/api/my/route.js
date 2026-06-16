import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

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

async function getVipPurchaseInfo(phone) {
  const key = `transactions:${phone}`
  if ((await kv.type(key)) !== 'list') return { date: null, amount: 0 }
  
  const raw = await kv.lrange(key, 0, 199)
  const tx = raw
    .map(safeParse)
    .filter(Boolean)
    .find(t => t.type === 'viptask_purchase' || t.type === 'vip_purchase')
  
  return {
    date: tx?.date || tx?.time || tx?.createdAt || null,
    amount: Number(tx?.amount) || 0
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
        balance: Number(user.balance) || 0, // direct from KV
        vip: Number(user.vip) || 0,
        avatar: user.avatar || '',
        createdAt: user.createdAt || ''
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