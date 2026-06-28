import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'
import { VIPS } from '@/app/api/viplevels/route'

const redis = Redis.fromEnv()
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

/*
Keys: EXACT match your Redis
book:{phone}:{date}:{bookId} -> HSET status
user:{phone} -> HSET balance
tx:{phone} -> LPUSH tx JSON = Daily Income tab
book_submission:{txId} -> HSET tx details = Transaction History tab
lock:submit:{phone}:{date}:{bookId} -> NX lock
*/
const SUBMIT_LUA = `
local bookKey = KEYS[1]
local userKey = KEYS[2]
local txKey = KEYS[3]
local lockKey = KEYS[4]
local booksSetKey = KEYS[5]
local submissionKey = KEYS[6] -- book_submission:{txId}

local today = ARGV[1]
local bookIdStr = ARGV[2]
local earned = tonumber(ARGV[3])
local txJson = ARGV[4]
local txId = ARGV[5]
local booksLimit = tonumber(ARGV[6])
local nowMs = ARGV[7]

-- 1. IDEMPOTENCY
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

-- 3. USER + DAILY LIMIT + RESET
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
redis.call('LPUSH', txKey, txJson) -- Daily Income tab
redis.call('SADD', booksSetKey, bookIdStr)

-- 5. WRITE TO book_submission:{txId} HASH = Transaction History tab
local tx = cjson.decode(txJson)
redis.call('HSET', submissionKey, 
  'id', tx.id,
  'type', tx.type,
  'bookId', tx.bookId,
  'amount', tx.amount,
  'createdAt', tx.createdAt,
  'status', tx.status,
  'description', tx.description,
  'phone', tx.phone
)
redis.call('EXPIRE', submissionKey, 2592000) -- 30 days TTL

return {1, 'ok'}
`

export async function POST(request) {
  try {
    const { phone, bookId, action } = await request.json()
    if (!phone ||!bookId) {
      return NextResponse.json({ error: "Missing phone or Book ID" }, { status: 400 })
    }
    if (action!== 'submit') {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const today = getUgandaDateString()
    const bookIdStr = String(bookId)
    const bookKey = `book:${phone}:${today}:${bookIdStr}`
    const userKey = `user:${phone}`
    const txKey = `tx:${phone}`
    const lockKey = `lock:submit:${phone}:${today}:${bookIdStr}`
    const booksSetKey = `books:${phone}:${today}`
    
    const txId = `${phone}:${today}:${bookIdStr}:${Date.now()}` // 0753520252:2026-06-28:1513:178...
    const submissionKey = `book_submission:${txId}` // <- This is what your app reads

    const user = await redis.hgetall(userKey)
    if (!user?.phone) {
      return NextResponse.json({ error: "User profile missing" }, { status: 404 })
    }

    const vip = Number(user.vip || 0)
    const vipConfig = VIPS[vip]
    if (!vipConfig) return NextResponse.json({ error: "Invalid VIP level" }, { status: 400 })

    const paymentAmount = Number(vipConfig.perBook)

    const tx = {
      id: txId,
      type: 'daily_income',
      bookId: bookIdStr,
      amount: String(paymentAmount),
      createdAt: String(Date.now()),
      status: 'success',
      description: `Daily income book submission (VIP ${vip})`,
      phone: phone
    }

    const res = await redis.eval(
      SUBMIT_LUA,
      [bookKey, userKey, txKey, lockKey, booksSetKey, submissionKey], // <- 6 keys now
      [
        today,
        bookIdStr,
        String(paymentAmount),
        JSON.stringify(tx),
        txId,
        String(vipConfig.books),
        String(Date.now())
      ]
    )

    if (res[0] === 0) {
      return NextResponse.json({ error: res[1] }, { status: 409, headers: { 'Cache-Control': 'no-store' } })
    }

    const updatedUser = await redis.hgetall(userKey)
    return NextResponse.json({
      success: true,
      earned: paymentAmount,
      txId, // <- return it so frontend can link
      user: {
      ...updatedUser,
        availableBalance: Number(updatedUser.availableBalance || 0),
        dailyIncome: Number(updatedUser.dailyIncome || 0),
        books_read_today: Number(updatedUser.books_read_today || 0),
      }
    }, { status: 200, headers: { 'Cache-Control': 'no-store' } })

  } catch (error) {
    console.error("Submit error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}