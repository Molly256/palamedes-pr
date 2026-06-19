import { db } from '../../../lib/db'
import { NextResponse } from 'next/server'

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')
  if (phone.length === 9 &&!phone.startsWith('0')) phone = '0' + phone
  return phone
}

async function buildTeams(phone) {
  const phoneNorm = normalizePhone(phone)

  // Get level 1, 2, 3 downlines in one query each
  const [teamA, teamB, teamC] = await Promise.all([
    db.execute(
      `SELECT phone, username, nickname, vip, vip_paid_at, vip
       FROM users
       WHERE referrer =? AND referral_level =1`,
      [phoneNorm]
    ),
    db.execute(
      `SELECT phone, username, nickname, vip, vip_paid_at, vip
       FROM users
       WHERE referrer IN (SELECT phone FROM users WHERE referrer =? AND referral_level =1)
       AND referral_level =2`,
      [phoneNorm]
    ),
    db.execute(
      `SELECT phone, username, nickname, vip, vip_paid_at, vip
       FROM users
       WHERE referrer IN (
         SELECT phone FROM users WHERE referrer IN (
           SELECT phone FROM users WHERE referrer =? AND referral_level =1
         ) AND referral_level =2
       ) AND referral_level =3`,
      [phoneNorm]
    )
  ])

  const formatTeam = (rows) => rows.rows.map(u => ({
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

  const res = await db.execute(
    `SELECT SUM(amount) as total
     FROM transactions
     WHERE phone =? AND type ='referral_reward' AND status!='rejected'`,
    [phoneNorm]
  )

  const total = Number(res.rows[0]?.total) || 0
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