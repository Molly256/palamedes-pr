import { kv } from '@vercel/kv'

function safeParse(val) {
  if (!val || val === '' || val === 'null' || val === 'undefined') return null
  try {
    return JSON.parse(val)
  } catch {
    return null
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')?.replace(/\s+/g, '')
    
    if (!phone) {
      return Response.json({ success: false, message: 'Phone required' })
    }

    // 1. Get total commission from transactions
    const txList = await kv.lrange(`transactions:${phone}`, 0, -1)
    const totalCommission = txList
      .map(t => safeParse(t))
      .filter(t => t && t.type === 'referral_reward')
      .reduce((sum, t) => sum + Number(t.amount || 0), 0)

    // 2. Get all users to build ABC teams
    const allKeys = await kv.keys('phone:palamedes:*')
    const teamA = []
    const teamB = []
    const teamC = []

    for (const key of allKeys) {
      const user = await kv.hgetall(key)
      if (!user || !user.phone) continue

      // Team A: direct invites
      if (user.upline1 === phone) {
        const commission = await getCommissionFromUser(user.phone, phone)
        teamA.push({
          username: user.username,
          phone: user.phone,
          vipLevel: Number(user.vip) || 0,
          hasCommission: commission > 0,
          commissionEarned: commission
        })
      }

      // Team B: level 2
      if (user.upline2 === phone) {
        const commission = await getCommissionFromUser(user.phone, phone)
        teamB.push({
          username: user.username,
          phone: user.phone,
          vipLevel: Number(user.vip) || 0,
          hasCommission: commission > 0,
          commissionEarned: commission
        })
      }

      // Team C: level 3
      if (user.upline3 === phone) {
        const commission = await getCommissionFromUser(user.phone, phone)
        teamC.push({
          username: user.username,
          phone: user.phone,
          vipLevel: Number(user.vip) || 0,
          hasCommission: commission > 0,
          commissionEarned: commission
        })
      }
    }

    return Response.json({
      success: true,
      totalCommission,
      teamA,
      teamB,
      teamC
    })

  } catch (err) {
    console.error('GET /api/myteam error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}

// Helper: get how much commission this user generated for the upline
async function getCommissionFromUser(memberPhone, uplinePhone) {
  const txList = await kv.lrange(`transactions:${uplinePhone}`, 0, -1)
  return txList
    .map(t => safeParse(t))
    .filter(t => 
      t && 
      t.type === 'referral_reward' && 
      t.desc && 
      t.desc.includes(memberPhone)
    )
    .reduce((sum, t) => sum + Number(t.amount || 0), 0)
}