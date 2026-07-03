import { Redis } from '@upstash/redis'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// FIXED: Using standard fromEnv initializer prevents configuration sync mismatches
const redis = Redis.fromEnv()

const VIP_COLORS = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
};

function safeNumber(val, fallback = 0) {
  if (val === undefined || val === null) return fallback
  const n = Number(val)
  return isNaN(n) ? fallback : n
}

function isEmptyHash(user) {
  return !user || Array.isArray(user) || Object.keys(user).length === 0
}

// ==========================================
// GET: Used by dashboard to fetch user data
// ==========================================
export async function GET(request) {
  try {
    // FIXED: Safely parse standard request URL parameters to prevent nextUrl crashes
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const phone = searchParams.get('phone')

    if (!phone) {
      return Response.json({ success: false, message: 'Phone required' }, { status: 400 })
    }

    // Settings block feature fallback: handled if no specific action is provided
    if (!action) {
      const userKey = `user:${phone}`;
      const data = await redis.hgetall(userKey);

      if (isEmptyHash(data)) {
        return Response.json({ success: false, message: "User not found" }, { status: 404 });
      }

      // FIXED: Added inviteCode and availableBalance here so your dashboard data doesn't get wiped out!
      return Response.json({
        success: true,
        user: {
          phone: data.phone ? String(data.phone) : phone,
          username: data.username ? String(data.username) : '',
          avatar: data.avatar || '',
          vip: safeNumber(data.vip),
          inviteCode: data.inviteCode ? String(data.inviteCode) : '',
          availableBalance: safeNumber(data.availableBalance, 0)
        }
      });
    }

    if (action === 'getDashboard') {
      const user = await redis.hgetall(`user:${phone}`)
      
      if (isEmptyHash(user)) {
        return Response.json({ success: false, message: 'User not found' }, { status: 404 })
      }

      // FIXED: Strictly extracts availableBalance only
      const currentAvailable = safeNumber(user.availableBalance, 0)

      return Response.json({ 
        success: true, 
        user: {
          phone: user.phone ? String(user.phone) : '',
          username: user.username ? String(user.username) : '',
          inviteCode: user.inviteCode ? String(user.inviteCode) : '', // 👈 Crucial fallback anchor for your invite page links!
          availableBalance: currentAvailable, 
          vip: safeNumber(user.vip),
          avatar: user.avatar || ''
        }
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
    }

    return Response.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('GET /api/user error:', err)
    return Response.json({ success: false, message: 'Server error parsing dashboard data' }, { status: 500 })
  }
}

// ==========================================
// POST: Used for login, update profile, etc.
// ==========================================
export async function POST(request) {
  try {
    const body = await request.json()
    // Added avatar to the destructured body fields
    const { action, phone, username, avatar, password, oldPassword, newPassword } = body

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

      const currentAvailable = safeNumber(user.availableBalance, 0)

      return Response.json({ 
        success: true, 
        user: {
          phone: user.phone ? String(user.phone) : '',
          username: user.username ? String(user.username) : '',
          inviteCode: user.inviteCode ? String(user.inviteCode) : '',
          availableBalance: currentAvailable,
          vip: safeNumber(user.vip),
          avatar: user.avatar || ''
        }
      })
    }

    if (action === 'update') {
      const updateData = {}
      if (username) updateData.username = String(username)
      if (password) updateData.password = String(password)
      // 👇 FIXED: This saves the avatar string to your Upstash Redis database
      if (avatar) updateData.avatar = String(avatar) 

      // FIXED: Stop empty hash writes from crashing your database execution pipeline
      if (Object.keys(updateData).length === 0) {
        return Response.json({ success: false, message: 'No update data provided' }, { status: 400 })
      }

      await redis.hset(userKey, updateData)
      const updatedUser = await redis.hgetall(userKey)
      const currentAvailable = safeNumber(updatedUser.availableBalance, 0)

      return Response.json({ 
        success: true, 
        user: {
          phone: updatedUser.phone ? String(updatedUser.phone) : '',
          username: updatedUser.username ? String(updatedUser.username) : '',
          inviteCode: updatedUser.inviteCode ? String(updatedUser.inviteCode) : '',
          availableBalance: currentAvailable,
          vip: safeNumber(updatedUser.vip),
          avatar: updatedUser.avatar || ''
        }
      })
    }

    // Handle Username Update from settings block
    if (action === "updateUsername") {
      await redis.hset(userKey, { username });
      return Response.json({ success: true });
    }

    // Handle Password Update from settings block - FIXED ONLY THIS BLOCK
    if (action === "updatePassword") {
      const user = await redis.hgetall(userKey); // 1. Read user:phone key from Redis
      if (isEmptyHash(user)) {
        return Response.json({ success: false, message: "User not found" }, { status: 404 });
      }

      const currentPassword = String(user.password || ''); // 2. Lookup password field
      if (currentPassword !== String(oldPassword)) { // 3. If user old password matches Redis password
        return Response.json({ success: false, message: "Incorrect old password" }, { status: 400 });
      }

      await redis.hset(userKey, { password: String(newPassword) }); // 4. Remove old, store new password
      return Response.json({ success: true, message: "Password updated" });
    }

    return Response.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/user error:', err)
    return Response.json({ success: false, message: 'Server processing error during update' }, { status: 500 })
  }
}