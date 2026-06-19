import { db } from '../../../lib/db'
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

async function getUserData(phone) {
  const res = await db.execute('SELECT * FROM users WHERE phone =?', [phone])
  const user = res.rows[0] || null
  return { user }
}

async function getVipPurchaseInfo(phone) {
  const res = await db.execute(
    `SELECT date, amount FROM transactions
     WHERE phone =? AND (type ='viptask_purchase' OR type ='vip_purchase')
     ORDER BY date DESC LIMIT 1`,
    [phone]
  )

  const tx = res.rows[0]
  return {
    date: tx?.date || null,
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