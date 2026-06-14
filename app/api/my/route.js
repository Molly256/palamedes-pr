import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

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

async function getUserData(phone) {
  const userKey = `user:${phone}`
  if ((await kv.type(userKey)) === 'hash') {
    const user = await kv.hgetall(userKey)
    return { user, userKey }
  }
  return { user: null, userKey: null }
}

async function getTransactions(phone) {
  const key = `transactions:${phone}`
  if ((await kv.type(key))!== 'list') return []
  const raw = await kv.lrange(key, 0, 99)
  return raw.map(t => safeParse(t)).filter(Boolean)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    let phone = normalizePhone(searchParams.get('phone'))
    if (!phone) return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })

    const { user } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const transactions = await getTransactions(phone)
    const recentTx = transactions.slice(0, 49)
    const vipTx = transactions.find(t => t.type === 'viptask_purchase')

    return NextResponse.json({
      success: true,
      user: {
        username: user.username || '',
        phone: user.phone || phone,
        balance: Number(user.balance) || 0,
        vip: Number(user.vip) || 0,
        avatar: user.avatar || '',
        nickname: user.nickname || '',
        vipLocked: user.vipLocked === 'true',
        tasksCompleted: Number(user.tasksCompleted) || 0,
        vipPricePaid: Number(user.vipPricePaid) || 0, // <-- this is the key fix
        referralPaid: user.referralPaid || 'false',
        vip_commission_paid: user.vip_commission_paid || 'false',
        upline1: user.upline1 || '',
        upline2: user.upline2 || '',
        upline3: user.upline3 || '',
        createdAt: user.createdAt || ''
      },
      transactions: recentTx,
      vipPurchaseDate: vipTx?.date || null
    })
  } catch (err) {
    console.error('GET /api/my error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}