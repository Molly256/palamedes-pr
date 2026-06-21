import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')
  if (phone.length === 9 && !phone.startsWith('0')) phone = '0' + phone
  return phone
}

async function buildTeams(phone) {
  const phoneNorm = normalizePhone(phone)

  // Get team A: direct downlines
  const teamAPhones = await redis.smembers(`downlines:${phoneNorm}:1`)
  
  // Get team B: downlines of team A
  const teamBPhones = new Set()
  for (const p of teamAPhones) {
    const phones = await redis.smembers(`downlines:${p}:1`)
    phones.forEach(x => teamBPhones.add(x))
  }

  // Get team C: downlines of team B
  const teamCPhones = new Set()
  for (const p of teamBPhones) {
    const phones = await redis.smembers(`downlines:${p}:1`)
    phones.forEach(x => teamCPhones.add(x))
  }

  // Fetch user data for each phone
  const [teamA, teamB, teamC] = await Promise.all([
    Promise.all([...teamAPhones].map(p => redis.hgetall(`user:${p}`))),
    Promise.all([...teamBPhones].map(p => redis.hgetall(`user:${p}`))),
    Promise.all([...teamCPhones].map(p => redis.hgetall(`user:${p}`)))
  ])

  const formatTeam = (rows) => rows
    .filter(u => u && Object.keys(u).length > 0)
    .map(u => ({
      phone: u.phone,
      username: u.username || '',
      nickname: u.nickname || '',
      vip: Number(u.vip) || 0,
      vipPaidAt: u.vip_paid_at || null,
      vipBought: Number(u.vip) > 0
    }))

  return {
    teamA: formatTeam(teamA),
    teamB: formatTeam(teamB),
    teamC: formatTeam(teamC)
  }
}

async function getTotalCommission(phone) {
  const phoneNorm = normalizePhone(phone)
  const txList = await redis.lrange(`tx:${phoneNorm}`, 0, 999)
  
  let total = 0
  for (const txStr of txList) {
    const tx = JSON.parse(txStr)
    if (tx.type === 'referral_reward' && tx.status !== 'rejected') {
      total += Number(tx.amount) || 0
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