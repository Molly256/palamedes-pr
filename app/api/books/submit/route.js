export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import { VIPS } from '@/app/config/vips'

const redis = Redis.fromEnv()

const toNum = (v, f = 0) => {
  const n = Number(v)
  return Number.isNaN(n)? f : n
}

const getUgandaDateString = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

/*
Keys:
book:{phone}:{date}:{bookId} -> HSET status
user:{phone} -> HSET balance
tx:{phone} -> LPUSH tx JSON = Daily Income tab
book_submission:{txId} -> HSET tx details = Transaction History tab
idem:{txId} -> SET EX = Idempotency guard for Chrome retry
*/

const SUBMIT_LUA = `
local bookKey = KEYS[1]
local userKey = KEYS[2]
local txKey = KEYS[3]
local ssetKey = KEYS[4]
local booksSetKey = KEYS[5]
local idemKey = KEYS[6]

local action, today, bookIdStr, earned, txJson, txId, booksLimit, nowMs, title, cover =
ARGV[1], ARGV[2], ARGV[3], tonumber(ARGV[4]), ARGV[5], ARGV[6], tonumber(ARGV[7]), ARGV[8], ARGV[9], ARGV[10]

if action == 'read' then
  local status = redis.call('HGET', bookKey, 'status')
  if status == 'submitted' then return {1, 'READ'} end
  if status == 'read' then return {1, 'READ'} end
  redis.call('HSET', bookKey, 'status', 'read', 'readAt', nowMs)
  return {1, 'READ'}
end

if action == 'submit' then
  -- 0. IDEMPOTENCY: If Chrome retried, we already paid.
  if redis.call('EXISTS', idemKey) == 1 then
    return {0, 'ALREADY_PAID'}
  end
  
  -- 1. ATOMIC GATEKEEPER: Must be 'read' to submit. If not, fail.
  local status = redis.call('HGET', bookKey, 'status')
  if status ~= 'read' then
    return {0, 'ALREADY_PAID'}
  end
  -- Only winner sets to submitted
  redis.call('HSET', bookKey, 'status', 'submitted', 'submittedAt', nowMs, 'reward', earned)

  -- 2. USER + DAILY LIMIT + RESET
  local user = redis.call('HGETALL', userKey)
  if #user == 0 then
    redis.call('HSET', bookKey, 'status', 'read') -- rollback
    return {0, 'USER_NOT_FOUND'}
  end

  local u = {}
  for i=1, #user, 2 do u[user[i]] = user[i+1] end

  if u.lastResetDate ~= today then
    redis.call('HSET', userKey, 'books_read_today', '0', 'dailyIncome', '0', 'lastResetDate', today)
  end

  if tonumber(u.books_read_today or 0) >= booksLimit then
    redis.call('HSET', bookKey, 'status', 'read') -- rollback
    return {0, 'DAILY_LIMIT'}
  end

  -- 3. ATOMIC PAYOUT
  redis.call('HINCRBY', userKey, 'availableBalance', earned)
  redis.call('HINCRBY', userKey, 'balance', earned)
  redis.call('HINCRBY', userKey, 'dailyIncome', earned)
  redis.call('HINCRBY', userKey, 'books_read_today', 1)
  redis.call('LPUSH', txKey, txJson) -- Daily Income tab
  redis.call('SADD', booksSetKey, bookIdStr)

  -- 4. WRITE TO book_submission:{txId} HASH = Transaction History tab
  redis.call('HSET', ssetKey,
    'id', txId,
    'type', 'daily_income',
    'bookId', bookIdStr,
    'amount', earned,
    'createdAt', nowMs,
    'status', 'success',
    'phone', u.phone,
    'title', title,
    'cover', cover
  )
  redis.call('EXPIRE', ssetKey, 2592000)

  -- 5. MARK AS PAID: Stops Chrome retry double pay
  redis.call('SET', idemKey, '1', 'EX', 86400)

  return {1, 'OK'}
end

return {0, 'INVALID_ACTION'}
`

export async function POST(request) {
  try {
    const { phone, bookId, action, title, cover } = await request.json()
    if (!phone ||!bookId ||!action) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 })
    }

    const today = getUgandaDateString()
    const bookIdStr = String(bookId)
    const txId = `${phone}:${today}:${bookIdStr}:${action}`
    const idemKey = `idem:${txId}`

    const user = await redis.hgetall(`user:${phone}`)
    if (!user?.phone) {
      return NextResponse.json({ error: "User profile missing" }, { status: 404 })
    }

    const vip = toNum(user.vip)
    const vipConfig = VIPS[vip]
    if (!vipConfig) return NextResponse.json({ error: "Invalid VIP level" }, { status: 400 })

    const paymentAmount = vipConfig.perBook
    const nowMs = String(Date.now())

    const tx = JSON.stringify({
      id: txId,
      type: 'daily_income',
      bookId: bookIdStr,
      amount: paymentAmount,
      createdAt: nowMs,
      status: 'success',
      phone
    })

    const res = await redis.eval(
      SUBMIT_LUA,
      [
        `book:${phone}:${today}:${bookIdStr}`,
        `user:${phone}`,
        `tx:${phone}`,
        `book_submission:${txId}`,
        `books:${phone}:${today}`,
        idemKey
      ],
      [
        action, today, bookIdStr, String(paymentAmount), tx, txId,
        String(vipConfig.books), nowMs, title || '', cover || ''
      ]
    )

    if (res[0] === 0) {
      const msg = res[1]
      if (msg === 'ALREADY_PAID') return NextResponse.json({ error: 'Already submitted' }, { status: 409 })
      if (msg === 'NOT_READ_YET') return NextResponse.json({ error: 'Click Read first' }, { status: 400 })
      if (msg === 'DAILY_LIMIT') return NextResponse.json({ error: "TODAY'S BOOKS ARE DONE" }, { status: 400 })
      return NextResponse.json({ error: msg }, { status: 400 })
    }

    const updatedUser = await redis.hgetall(`user:${phone}`)
    return NextResponse.json({
      success: true,
      earned: paymentAmount,
      txId,
      user: {
      ...updatedUser,
        availableBalance: toNum(updatedUser.availableBalance),
        dailyIncome: toNum(updatedUser.dailyIncome),
        books_read_today: toNum(updatedUser.books_read_today),
        vip: toNum(updatedUser.vip)
      }
    }, { headers: { 'Cache-Control': 'no-store' } })

  } catch (error) {
    console.error("Submit error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}