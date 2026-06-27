import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { VIPS } from '@/app/api/viplevels/route'

const redis = Redis.fromEnv()
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

// ATOMIC LUA SCRIPT: 0=fail, 1=success
const SUBMIT_LUA = `
local bookKey = KEYS[1]
local userKey = KEYS[2]
local txKey = KEYS[3]
local lockKey = KEYS[4]
local today = ARGV[1]
local bookIdStr = ARGV[2]
local earned = tonumber(ARGV[3])
local txJson = ARGV[4]

-- 1. Lock check: only 1 request ever
if redis.call('SET', lockKey, '1', 'NX', 'EX', '30') == nil then
  return {0, 'Already submitted'}
end

-- 2. Book status check
local status = redis.call('HGET', bookKey, 'status')
if status == 'submitted' then
  return {0, 'Already submitted'}
end
if status ~= 'read' then
  redis.call('DEL', lockKey) -- release lock if fail
  return {0, 'Click Read first'}
end

-- 3. User + VIP checks
local user = redis.call('HGETALL', userKey)
if not user or #user == 0 then
  redis.call('DEL', lockKey)
  return {0, 'User not found'}
end

local userMap = {}
for i=1, #user, 2 do userMap[user[i]] = user[i+1] end

if userMap.lastResetDate ~= today then
  redis.call('HSET', userKey, 'books_read_today', 0, 'dailyIncome', 0, 'lastResetDate', today)
  userMap.books_read_today = '0'
  userMap.dailyIncome = '0'
end

local booksReadToday = tonumber(userMap.books_read_today or 0)
local vip = tonumber(userMap.vip or 0)
local booksLimit = tonumber(ARGV[5])

if booksReadToday >= booksLimit then
  redis.call('DEL', lockKey)
  return {0, "TODAY'S BOOKS ARE DONE"}
end

-- 4. ATOMIC PAYOUT
redis.call('HSET', bookKey, 'status', 'submitted', 'submittedAt', ARGV[6])
redis.call('HINCRBY', userKey, 'availableBalance', earned)
redis.call('HINCRBY', userKey, 'dailyIncome', earned)
redis.call('HINCRBY', userKey, 'books_read_today', 1)
redis.call('LPUSH', txKey, txJson)

return {1, 'ok'}
`

export async function POST(req) {
  try {
    const { phone, bookId, action } = await req.json()
    if (!phone ||!bookId ||!action) {
      return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })
    }

    const today = getUgandaDateString()
    const bookKey = `book:${phone}:${today}:${bookId}`
    const userKey = `user:${phone}`
    const txKey = `tx:${phone}`
    const bookIdStr = String(bookId)
    const lockKey = `lock:submit:${phone}:${today}:${bookIdStr}`

    if (action === 'read') {
      await redis.hset(bookKey, { bookId: bookIdStr, status: 'read', readAt: Date.now() })
      return NextResponse.json({ success: true, status: 'read' })
    }

    if (action === 'submit') {
      const user = await redis.hgetall(userKey)
      if (!user?.phone) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

      const vip = Number(user.vip || 0)
      const vipConfig = VIPS[vip]
      if (!vipConfig) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

      const earned = vipConfig.perBook
      const tx = {
        id: `${phone}:${today}:${bookIdStr}:${Date.now()}`,
        type: 'book_submission',
        bookId: bookIdStr,
        amount: String(earned),
        createdAt: String(Date.now()),
        status: 'success',
        phone
      }

      // 1 ATOMIC CALL. Redis runs this or nothing.
      const res = await redis.eval(
        SUBMIT_LUA,
        [bookKey, userKey, txKey, lockKey],
        [
          today,
          bookIdStr,
          String(earned),
          JSON.stringify(tx),
          String(vipConfig.books),
          String(Date.now())
        ]
      )

      if (res[0] === 0) {
        return NextResponse.json({ success: false, message: res[1] }, { status: 400 })
      }

      const updatedUser = await redis.hgetall(userKey)
      return NextResponse.json({
        success: true,
        user: {
        ...updatedUser,
          completedBooks: [],
          availableBalance: Number(updatedUser.availableBalance || 0),
          dailyIncome: Number(updatedUser.dailyIncome || 0),
          books_read_today: Number(updatedUser.books_read_today || 0),
        },
        earned,
        status: 'submitted',
        message: `+${earned} UGX`
      })
    }
    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('Submit error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}