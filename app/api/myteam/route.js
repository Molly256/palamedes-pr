import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')
  if (phone.length === 9 && !phone.startsWith('0')) phone = '0' + phone
  return phone
}

// Build full downline recursively from user sets
async function buildTeams(phone) {
  const phoneNorm = normalizePhone(phone)
  
  // Get downline sets directly - this is faster and more accurate than scanning all users
  const [downline1, downline2, downline3] = await Promise.all([
    kv.smembers(`user:${phoneNorm}:downline1`),
    kv.smembers(`user:${phoneNorm}:downline2`),
    kv.smembers(`user:${phoneNorm}:downline3`)
  ])

  const teamA = []
  const teamB = []
  const teamC = []

  // Process Team A
  for (const memberPhone of downline1) {
    const user = await kv.hgetall(`user:${memberPhone}`)
    if (!user || !user.phone) continue
    teamA.push({
      phone: user.phone,
      username: user.username || '',
      nickname: user.nickname || '',
      vip: Number(user.vip) || 0,
      vipPaidAt: user.vip_paid_at || null,
      vipBought: Number(user.vip) > 0
    })
  }

  // Process Team B
  for (const memberPhone of downline2) {
    const user = await kv.hgetall(`user:${memberPhone}`)
    if (!user || !user.phone) continue
    teamB.push({
      phone: user.phone,
      username: user.username || '',
      nickname: user.nickname || '',
      vip: Number(user.vip) || 0,
      vipPaidAt: user.vip_paid_at || null,
      vipBought: Number(user.vip) > 0
    })
  }

  // Process Team C
  for (const memberPhone of downline3) {
    const user = await kv.hgetall(`user:${memberPhone}`)
    if (!user || !user.phone) continue
    teamC.push({
      phone: user.phone,
      username: user.username || '',
      nickname: user.nickname || '',
      vip: Number(user.vip) || 0,
      vipPaidAt: user.vip_paid_at || null,
      vipBought: Number(user.vip) > 0
    })
  }

  return { teamA, teamB, teamC }
}

async function getTotalCommission(phone) {
  const transactions = await kv.lrange(`transactions:${phone}`, 0, 99)
  return transactions
    .map(t => {
      try { return JSON.parse(t) } catch { return null }
    })
    .filter(t => t?.type === 'referral_reward' && t?.status !== 'rejected')
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = normalizePhone(searchParams.get('phone'))

    if (!phone) {
      return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    const { teamA, teamB, teamC } = await buildTeams(phone)
    const totalCommission = await getTotalCommission(phone)

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