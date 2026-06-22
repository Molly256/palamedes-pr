import { Redis } from '@upstash/redis'
const redis = Redis.fromEnv()

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    if (!phone) return Response.json({ success: false, message: 'Missing phone' }, { status: 400 })

    // Get all invitation rewards from tx history
    const txList = await redis.lrange(`tx:${phone}`, 0, 9999)
    
    let totalCommission = 0
    let teamACount = 0
    let teamBCount = 0
    let teamCCount = 0

    for (const txStr of txList) {
      const tx = JSON.parse(txStr)
      if (tx.type !== 'invitation_reward' || tx.status !== 'completed') continue
      
      totalCommission += Number(tx.amount || 0)
      
      if (tx.level === 1) teamACount++
      if (tx.level === 2) teamBCount++
      if (tx.level === 3) teamCCount++
    }

    return Response.json({ 
      success: true, 
      total: totalCommission,
      breakdown: {
        teamA: teamACount,
        teamB: teamBCount,
        teamC: teamCCount
      }
    })
  } catch (err) {
    console.error(err)
    return Response.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}