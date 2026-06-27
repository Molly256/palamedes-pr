import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

function safeNumber(val, fallback = 0) {
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

function isEmptyHash(user) {
  return !user || Array.isArray(user) || Object.keys(user).length === 0
}

// GET: used by dashboard to fetch user data
export async function GET(request) {
  try {
    const action = request.nextUrl.searchParams.get('action')
    const phone = request.nextUrl.searchParams.get('phone')

    if (!phone) {
      return Response.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    if (action === 'getDashboard') {
      const user = await redis.hgetall(`user:${phone}`)
      
      if (isEmptyHash(user)) {
        return Response.json({ success: false, message: 'User not found' }, { status: 404 })
      }

      // FIX: Use availableBalance. Fallback to balance for old users
      const availableBalance = safeNumber(user.availableBalance) || safeNumber(user.balance)

      return Response.json({ 
        success: true, 
        user: {
          phone: user.phone,
          username: user.username,
          balance: availableBalance, // <- Dashboard expects 'balance'
          availableBalance: availableBalance, // <- Keep both for safety
          vip: safeNumber(user.vip),
          avatar: user.avatar || ''
        }
      })
    }

    return Response.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('GET /api/user error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}

// POST: used for login, update profile, etc.
export async function POST(request) {
  try {
    const body = await request.json()
    const { action, phone, username, password } = body

    if (!phone) {
      return Response.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    const userKey = `user:${phone}`

    if (action === 'login') {
      const user = await redis.hgetall(userKey)
      
      if (isEmptyHash(user)) {
        return Response.json({ success: false, message: 'User not found' }, { status: 404 })
      }

      if (String(user.password || '') !== String(password)) {
        return Response.json({ success: false, message: 'Wrong password' }, { status: 401 })
      }

      const availableBalance = safeNumber(user.availableBalance) || safeNumber(user.balance)

      return Response.json({ 
        success: true, 
        user: {
          phone: user.phone,
          username: user.username,
          balance: availableBalance, // <- FIXED
          availableBalance: availableBalance,
          vip: safeNumber(user.vip),
          avatar: user.avatar || ''
        }
      })
    }

    if (action === 'update') {
      const updateData = {}
      if (username) updateData.username = username
      if (password) updateData.password = password

      await redis.hset(userKey, updateData)
      const updatedUser = await redis.hgetall(userKey)
      const availableBalance = safeNumber(updatedUser.availableBalance) || safeNumber(updatedUser.balance)

      return Response.json({ 
        success: true, 
        user: {
          phone: updatedUser.phone,
          username: updatedUser.username,
          balance: availableBalance, // <- FIXED
          availableBalance: availableBalance,
          vip: safeNumber(updatedUser.vip),
          avatar: updatedUser.avatar || ''
        }
      })
    }

    return Response.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/user error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}