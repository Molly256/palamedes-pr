import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

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
      
      if (!user || Object.keys(user).length === 0) {
        return Response.json({ success: false, message: 'User not found' }, { status: 404 })
      }

      return Response.json({ 
        success: true, 
        user: {
          phone: user.phone,
          username: user.username,
          balance: Number(user.balance || 0),
          vip: Number(user.vip || 0),
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
      
      if (!user || Object.keys(user).length === 0) {
        return Response.json({ success: false, message: 'User not found' }, { status: 404 })
      }

      if (user.password !== password) {
        return Response.json({ success: false, message: 'Wrong password' }, { status: 401 })
      }

      return Response.json({ 
        success: true, 
        user: {
          phone: user.phone,
          username: user.username,
          balance: Number(user.balance || 0),
          vip: Number(user.vip || 0),
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

      return Response.json({ 
        success: true, 
        user: {
          phone: updatedUser.phone,
          username: updatedUser.username,
          balance: Number(updatedUser.balance || 0),
          vip: Number(updatedUser.vip || 0),
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