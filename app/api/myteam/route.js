import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')
  if (phone.length === 9 &&!phone.startsWith('0')) phone = '0' + phone
  return phone
}

// Full reward table matching your VIP_CONFIG
function getRewardForVip(vipLevel, teamLevel) {
  const rewards = {
    1: { 1: 4000, 2: 1600, 3: 800 },
    2: { 1: 12500, 2: 5000, 3: 2500 },
    3: { 1: 39500, 2: 15800, 3: 7900 },
    4: { 1: 50000, 2: 20000, 3: 10000 },
    5: { 1: 75000, 2: 30000, 3: 15000 },
    6: { 1: 105000, 2: 42000, 3: 21000 },
    7: { 1: 200000, 2: 80000, 3: 40000 },
    8: { 1: 230000, 2: 92000, 3: 46000 },
    9: { 1: 250000, 2: 100000, 3: 50000 },
    10: { 1: 400000, 2: 160000, 3: 80000 }
  }
  return rewards[vipLevel]?.[teamLevel] || 0
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const phone = normalizePhone(searchParams.get('phone'))

    if (!phone) {
      return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    const [downline1, downline2, downline3] = await Promise.all([
      kv.smembers(`user:${phone}:downline1`),
      kv.smembers(`user:${phone}:downline2`),
      kv.smembers(`user:${phone}:downline3`)
    ])

    const teamA = []
    const teamB = []
    const teamC = []

    // Build teams - NO commission logic here
    for (const memberPhone of downline1) {
      const user = await kv.hgetall(`user:${memberPhone}`)
      if (!user ||!user.phone) continue
      if (Number(user.vip) > 0) {
        teamA.push({
          username: user.username,
          phone: user.phone,
          vip: Number(user.vip),
          vipPaidAt: user.vip_paid_at
        })
      }
    }

    for (const memberPhone of downline2) {
      const user = await kv.hgetall(`user:${memberPhone}`)
      if (!user ||!user.phone) continue
      if (Number(user.vip) > 0) {
        teamB.push({
          username: user.username,
          phone: user.phone,
          vip: Number(user.vip),
          vipPaidAt: user.vip_paid_at
        })
      }
    }

    for (const memberPhone of downline3) {
      const user = await kv.hgetall(`user:${memberPhone}`)
      if (!user ||!user.phone) continue
      if (Number(user.vip) > 0) {
        teamC.push({
          username: user.username,
          phone: user.phone,
          vip: Number(user.vip),
          vipPaidAt: user.vip_paid_at
        })
      }
    }

    // Get total commission from transactions instead of calculating it
    const transactions = await kv.lrange(`transactions:${phone}`, 0, 99)
    const totalCommission = transactions
     .map(t => {
        try { return JSON.parse(t) } catch { return null }
      })
     .filter(t => t?.type === 'referral_reward')
     .reduce((sum, t) => sum + Number(t.amount || 0), 0)

    return NextResponse.json({
      success: true,
      totalCommission,
      teamA,
      teamB,
      teamC,
      teamCounts: {
        a: teamA.length,
        b: teamB.length,
        c: teamC.length,
        total: teamA.length + teamB.length + teamC.length
      }
    })

  } catch (err) {
    console.error('GET /api/myteam error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}