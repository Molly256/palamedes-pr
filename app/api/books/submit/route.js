import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { VIPS } from '@/app/api/viplevels/route'

const redis = Redis.fromEnv()
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

/*
ATOMIC: All checks + payout in 1 Redis call. Kills race conditions on Vercel.
Return: [1, 'ok'] = success | [0, 'reason'] = fail
*/
const SUBMIT_LUA = `
local bookKey = KEYS[1] -- book:{phone}:{today}:{bookId}
local userKey = KEYS[2] -- user:{phone}
local txKey = KEYS[3] -- tx:{phone} = Daily Income list
local lockKey = KEYS[4] -- lock:submit:{phone}:{today}:{bookId}

local today = ARGV[1]
local bookIdStr = ARGV[2]
local earned = tonumber(ARGV[3])
local txJson = ARGV[4]
local booksLimit = tonumber(ARGV[5])
local nowMs = ARGV[6]

-- 1. IDEMPOTENCY: Only 1 request can get the lock
if redis.call('SET', lockKey, '1', 'NX', 'EX', '30') == nil then
  return {0, 'Book already submitted today!'}
end

-- 2. STATUS CHECK
local status = redis.call('HGET', bookKey, 'status')
if status == 'submitted' then
  return {0, 'Book already submitted today!'}
end
if status ~= 'read' then
  redis.call('DEL', lockKey)
  return {0, 'Click Read first'}
end

-- 3. USER + DAILY LIMIT
local user = redis.call('HGETALL', userKey)
if not user or #user == 0 then
  redis.call('DEL', lockKey)
  return {0, 'User profile missing'}
end

local u = {}
for i=1, #user, 2 do u[user[i]] = user[i+1] end

if u.lastResetDate ~= today then
  redis.call('HSET', userKey, 'books_read_today', 0, 'dailyIncome', 0, 'lastResetDate', today)
  u.books_read_today = '0'
  u.dailyIncome = '0'
end

if tonumber(u.books_read_today or 0) >= booksLimit then
  redis.call('DEL', lockKey)
  return {0, "TODAY'S BOOKS ARE DONE"}
end

-- 4. ATOMIC PAYOUT
redis.call('HSET', bookKey, 'status', 'submitted', 'submittedAt', nowMs)
redis.call('HINCRBY', userKey, 'availableBalance', earned)
redis.call('HINCRBY', userKey, 'dailyIncome', earned)
redis.call('HINCRBY', userKey, 'books_read_today', 1)
redis.call('LPUSH', txKey, txJson) -- <- tx:phone

return {1, 'ok'}
`

export async function POST(request) {
  try {
    // 1. Auth - same as your Prisma version
    const session = await getServerSession(authOptions)
    if (!session ||!session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    const phone = session.user.id // id = phone

    // 2. Body
    const { bookId } = await request.json()
    if (!bookId) {
      return NextResponse.json({ error: "Missing Book ID" }, { status: 400 })
    }

    const today = getUgandaDateString()
    const bookIdStr = String(bookId)
    const bookKey = `book:${phone}:${today}:${bookIdStr}`
    const userKey = `user:${phone}`
    const txKey = `tx:${phone}` // <- This is your Daily Income tab key
    const lockKey = `lock:submit:${phone}:${today}:${bookIdStr}`

    // 3. Get VIP + amount
    const user = await redis.hgetall(userKey)
    if (!user?.phone) {
      return NextResponse.json({ error: "User profile missing" }, { status: 404 })
    }

    const vip = Number(user.vip || 0)
    const vipConfig = VIPS[vip]
    if (!vipConfig) return NextResponse.json({ error: "Invalid VIP level" }, { status: 400 })

    const paymentAmount = vipConfig.perBook

    const tx = {
      id: `${phone}:${today}:${bookIdStr}:${Date.now()}`,
      type: 'daily_income', // <- Filter for Daily Income tab
      bookId: bookIdStr,
      amount: String(paymentAmount),
      createdAt: String(Date.now()),
      status: 'success',
      description: `Daily income book submission (VIP ${vip})`,
      phone: phone
    }

    // 4. Run atomic
    const res = await redis.eval(
      SUBMIT_LUA,
      [bookKey, userKey, txKey, lockKey],
      [
        today,
        bookIdStr,
        String(paymentAmount),
        JSON.stringify(tx),
        String(vipConfig.books),
        String(Date.now())
      ]
    )

    if (res[0] === 0) {
      return NextResponse.json({ error: res[1] }, { status: 409 })
    }

    const updatedUser = await redis.hgetall(userKey)
    return NextResponse.json({
      success: true,
      earned: paymentAmount,
      user: {
       ...updatedUser,
        availableBalance: Number(updatedUser.availableBalance || 0),
        dailyIncome: Number(updatedUser.dailyIncome || 0),
        books_read_today: Number(updatedUser.books_read_today || 0),
      }
    }, { status: 200 })

  } catch (error) {
    console.error("Submit error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}