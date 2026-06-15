import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')
  if (phone.length === 9 && !phone.startsWith('0')) phone = '0' + phone
  return phone
}

async function buildTeams(phone) {
  const phoneNorm = normalizePhone(phone)
  
  const [downline1, downline2, downline3] = await Promise.all([
    kv.smembers(`user:${phoneNorm}:downline1`),
    kv.smembers(`user:${phoneNorm}:downline2`),
    kv.smembers(`user:${phoneNorm}:downline3`)
  ])

  const teamA = []
  const teamB = []
  const teamC = []

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
  const phoneNorm = normalizePhone(phone)
  
  // Read only the user's own transaction list
  const txList = await kv.lrange(`transactions:${phoneNorm}`, 0, 99)
  if (!txList) return 0

  let total = 0

  for (const tx of txList) {
    try {
      const txObj = typeof tx === 'string' ? JSON.parse(tx) : tx
      
      if (txObj.type === 'referral_reward' && txObj.status !== 'rejected') {
        total += Number(txObj.amount || 0)
      }
    } catch (e) {
      console.error(`MYTEAM: Parse error`, e)
    }
  }

  console.error(`MYTEAM: Phone ${phoneNorm} total commission = ${total}`)
  return total
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