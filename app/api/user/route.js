import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
const redis = Redis.fromEnv()

function normalizePhone(phone) {
  if (!phone) return null
  phone = String(phone).replace(/\D/g, '')
  if (phone.startsWith('256') && phone.length === 12) {
    phone = '0' + phone.slice(3)
  }
  if (!/^07\d{8}$/.test(phone)) return null
  return phone
}

async function getUserData(phone) {
  if (!phone) return { user: null }
  const user = await redis.hgetall(`user:${phone}`)
  return { user: user && Object.keys(user).length > 0 ? user : null }
}

async function getTransactions(phone) {
  if (!phone) return []
  const txList = await redis.lrange(`tx:${phone}`, 0, 49) // only recent 50
  return txList.map(t => {
    try { return JSON.parse(t) } catch { return null }
  }).filter(Boolean)
}

async function buildTeams(phone) {
  if (!phone) return { teamA: [], teamB: [], teamC: [] }

  const teamAPhones = await redis.smembers(`downlines:${phone}:1`)
  const teamBPhones = new Set()
  for (const p of teamAPhones) {
    const phones = await redis.smembers(`downlines:${p}:1`)
    phones.forEach(x => teamBPhones.add(x))
  }
  const teamCPhones = new Set()
  for (const p of teamBPhones) {
    const phones = await redis.smembers(`downlines:${p}:1`)
    phones.forEach(x => teamCPhones.add(x))
  }

  const [teamA, teamB, teamC] = await Promise.all([
    Promise.all([...teamAPhones].map(p => redis.hgetall(`user:${p}`))),
    Promise.all([...teamBPhones].map(p => redis.hgetall(`user:${p}`))),
    Promise.all([...teamCPhones].map(p => redis.hgetall(`user:${p}`)))
  ])

  return {
    teamA: teamA.filter(u => u && Object.keys(u).length > 0),
    teamB: teamB.filter(u => u && Object.keys(u).length > 0),
    teamC: teamC.filter(u => u && Object.keys(u).length > 0)
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    let phone = normalizePhone(searchParams.get('phone'))
    const action = searchParams.get('action')

    if (!phone) {
      return NextResponse.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    const { user } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    // Only dashboard action remains
    if (action === 'getDashboard') {
      const transactions = await getTransactions(phone)
      const vipTx = transactions.find(t => t.type === 'viptask_purchase')
      const vipPurchaseDate = vipTx ? vipTx.created_at : null
      const { teamA, teamB, teamC } = await buildTeams(phone)
      const totalEarnings = transactions
        .filter(t => t.type === 'referral_reward' && t.status === 'success')
        .reduce((sum, t) => sum + Number(t.amount || 0), 0)
      const balance = Number(user.balance || 0)

      return NextResponse.json({
        success: true,
        user: {
          username: user.username || '',
          phone: user.phone || phone,
          balance: balance,
          available_balance: balance,
          vip: Number(user.vip) || 0,
          avatar: user.avatar || '',
          nickname: user.nickname || '',
          vipLocked: user.vip_locked === 'true',
          hasBoughtVIP: Number(user.hasBoughtVIP) === 1,
          tasksCompleted: Number(user.tasks_completed) || 0,
          vipPricePaid: Number(user.vip_price_paid) || 0,
          firstVipAmount: Number(user.first_vip_amount) || 0,
          bankMTN: user.bank_mtn ? JSON.parse(user.bank_mtn) : null,
          bankAirtel: user.bank_airtel ? JSON.parse(user.bank_airtel) : null,
          referralPaid: user.referral_paid === 'true',
          upline1: user.upline1 || '',
          upline2: user.upline2 || '',
          upline3: user.upline3 || '',
          createdAt: user.created_at || ''
        },
        transactions: transactions,
        vipPurchaseDate,
        stats: {
          teamA: teamA.length,
          teamB: teamB.length,
          teamC: teamC.length,
          totalMembers: teamA.length + teamB.length + teamC.length,
          totalEarnings
        }
      })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('GET /api/user error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    let { action, phone, field, value, oldPass, newPass } = body

    phone = normalizePhone(phone)
    if (!phone) return NextResponse.json({ success: false, message: 'Invalid phone' }, { status: 400 })

    const { user } = await getUserData(phone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    // Settings actions only
    if (action === 'updateProfile') {
      if (field === 'nickname') {
        if (value.length > 6) return NextResponse.json({ success: false, message: 'Nickname max 6 letters' }, { status: 400 })
        await redis.hset(`user:${phone}`, { nickname: value })
        return NextResponse.json({ success: true, message: 'Nickname saved' })
      }
      if (field === 'bankMTN') {
        await redis.hset(`user:${phone}`, { bank_mtn: JSON.stringify(value) })
        return NextResponse.json({ success: true, message: 'MTN bank saved' })
      }
      if (field === 'bankAirtel') {
        await redis.hset(`user:${phone}`, { bank_airtel: JSON.stringify(value) })
        return NextResponse.json({ success: true, message: 'Airtel bank saved' })
      }
      if (field === 'avatar') {
        await redis.hset(`user:${phone}`, { avatar: value })
        return NextResponse.json({ success: true, message: 'Avatar updated' })
      }
    }

    if (action === 'changePassword') {
      if (String(user.password) !== String(oldPass)) {
        return NextResponse.json({ success: false, message: 'Old password incorrect' }, { status: 400 })
      }
      if (newPass.length < 6) {
        return NextResponse.json({ success: false, message: 'New password must be at least 6 characters' }, { status: 400 })
      }
      await redis.hset(`user:${phone}`, { password: newPass })
      return NextResponse.json({ success: true, message: 'Password changed' })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err){
    console.error('POST /api/user error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}