import { kv } from '@vercel/kv'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')?.replace(/\s+/g, '')

    if (!phone) {
      return Response.json({ success: false, message: 'Phone required' })
    }

    let totalCommission = 0
    const teamA = []
    const teamB = []
    const teamC = []

    // 1. Get downline phones from sets
    const [downline1, downline2, downline3] = await Promise.all([
      kv.smembers(`user:${phone}:downline1`),
      kv.smembers(`user:${phone}:downline2`),
      kv.smembers(`user:${phone}:downline3`)
    ])

    // 2. Process Team A - Level 1
    for (const memberPhone of downline1) {
      const user = await kv.hgetall(`user:${memberPhone}`)
      if (!user || !user.phone) continue

      const vip = Number(user.vip) || 0
      const commissionPaid = user.vip_commission_paid === 'true'

      if (vip > 0) {
        teamA.push({
          username: user.username,
          phone: user.phone,
          vip: vip,
          vipPaidAt: user.vip_paid_at
        })

        // Pay commission only on first VIP buy
        if (!commissionPaid) {
          const reward = getRewardForVip(vip, 1)
          if (reward > 0) {
            totalCommission += reward

            // Mark as paid and record transaction
            await kv.hset(`user:${memberPhone}`, 'vip_commission_paid', 'true')
            await kv.lpush(`transactions:${phone}`, JSON.stringify({
              type: 'referral_reward',
              amount: reward,
              from: memberPhone,
              level: 1,
              timestamp: Date.now()
            }))
          }
        }
      }
    }

    // 3. Process Team B - Level 2
    for (const memberPhone of downline2) {
      const user = await kv.hgetall(`user:${memberPhone}`)
      if (!user || !user.phone) continue

      const vip = Number(user.vip) || 0
      const commissionPaid = user.vip_commission_paid === 'true'

      if (vip > 0) {
        teamB.push({
          username: user.username,
          phone: user.phone,
          vip: vip,
          vipPaidAt: user.vip_paid_at
        })

        if (!commissionPaid) {
          const reward = getRewardForVip(vip, 2)
          if (reward > 0) {
            totalCommission += reward
            await kv.hset(`user:${memberPhone}`, 'vip_commission_paid', 'true')
            await kv.lpush(`transactions:${phone}`, JSON.stringify({
              type: 'referral_reward',
              amount: reward,
              from: memberPhone,
              level: 2,
              timestamp: Date.now()
            }))
          }
        }
      }
    }

    // 4. Process Team C - Level 3
    for (const memberPhone of downline3) {
      const user = await kv.hgetall(`user:${memberPhone}`)
      if (!user || !user.phone) continue

      const vip = Number(user.vip) || 0
      const commissionPaid = user.vip_commission_paid === 'true'

      if (vip > 0) {
        teamC.push({
          username: user.username,
          phone: user.phone,
          vip: vip,
          vipPaidAt: user.vip_paid_at
        })

        if (!commissionPaid) {
          const reward = getRewardForVip(vip, 3)
          if (reward > 0) {
            totalCommission += reward
            await kv.hset(`user:${memberPhone}`, 'vip_commission_paid', 'true')
            await kv.lpush(`transactions:${phone}`, JSON.stringify({
              type: 'referral_reward',
              amount: reward,
              from: memberPhone,
              level: 3,
              timestamp: Date.now()
            }))
          }
        }
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

// Set your reward amounts here
function getRewardForVip(vipLevel, teamLevel) {
  const rewards = {
    1: { 1: 500, 2: 200, 3: 100 },
    2: { 1: 1000, 2: 400, 3: 200 },
    3: { 1: 2000, 2: 800, 3: 400 }
  }
  return rewards[vipLevel]?.[teamLevel] || 0
}