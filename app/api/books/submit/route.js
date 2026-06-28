export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'
import { VIPS } from '@/app/config/vips'

const redis = Redis.fromEnv()
const toNum = (v, f = 0) => { const n = Number(v); return Number.isNaN(n)? f : n }
const getUgandaDateString = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })

const SUBMIT_LUA = `
local bookKey,userKey,txKey,ssetKey,booksSetKey,idemKey=KEYS[1],KEYS[2],KEYS[3],KEYS[4],KEYS[5],KEYS[6]
local action,today,bookIdStr,earned,txJson,txId,booksLimit,nowMs,title,cover=ARGV[1],ARGV[2],ARGV[3],tonumber(ARGV[4]),ARGV[5],ARGV[6],tonumber(ARGV[7]),ARGV[8],ARGV[9],ARGV[10]

if action=='read' then
 local s=redis.call('HGET',bookKey,'status')
 if s=='submitted' or s=='read' then return {1,'READ',s} end
 redis.call('HSET',bookKey,'status','read','readAt',nowMs)
 return {1,'READ','set'}
end

if action=='submit' then
 -- DEBUG 1: Check idemKey BEFORE SET
 local idemExists=redis.call('EXISTS',idemKey)
 if idemExists==1 then return {0,'ALREADY_PAID','idem_exists_1'} end
 
 -- DEBUG 2: ATOMIC LOCK. This is the fix. SET NX = only 1 wins.
 local setNx=redis.call('SET', idemKey, '1', 'NX', 'EX', '86400')
 if setNx==false then return {0,'ALREADY_PAID','idem_exists_2'} end
 
 -- DEBUG 3: Status check
 local status=redis.call('HGET',bookKey,'status')
 if status~='read' then redis.call('DEL', idemKey) return {0,'ALREADY_PAID','status_not_read:'..tostring(status)} end
 redis.call('HSET',bookKey,'status','submitted','submittedAt',nowMs,'reward',earned)

 -- DEBUG 4: Limit check
 local user=redis.call('HGETALL',userKey)
 if #user==0 then redis.call('HSET',bookKey,'status','read') redis.call('DEL', idemKey) return {0,'USER_NOT_FOUND','no_user'} end
 local u={} for i=1,#user,2 do u[user[i]]=user[i+1] end
 if u.lastResetDate~=today then redis.call('HSET',userKey,'books_read_today','0','dailyIncome','0','lastResetDate',today) end
 if tonumber(u.books_read_today or 0)>=booksLimit then redis.call('HSET',bookKey,'status','read') redis.call('DEL', idemKey) return {0,'DAILY_LIMIT','limit_hit'} end
 
 -- DEBUG 5: We are paying. Only 1 instance reaches here.
 redis.call('HINCRBY',userKey,'availableBalance',earned)
 redis.call('HINCRBY',userKey,'balance',earned)
 redis.call('HINCRBY',userKey,'dailyIncome',earned)
 redis.call('HINCRBY',userKey,'books_read_today',1)
 redis.call('LPUSH',txKey,txJson)
 redis.call('SADD',booksSetKey,bookIdStr)
 redis.call('HSET',ssetKey,'id',txId,'type','daily_income','bookId',bookIdStr,'amount',earned,'createdAt',nowMs,'status','success','phone',u.phone,'title',title,'cover',cover)
 redis.call('EXPIRE',ssetKey,2592000)
 return {1,'OK','PAID'}
end
return {0,'INVALID_ACTION','invalid'}
`

export async function POST(request) {
  const reqId = crypto.randomUUID().slice(0,8) // trace this request
  try {
    const { phone, bookId, action, title, cover } = await request.json()
    if (!phone ||!bookId ||!action) return NextResponse.json({ error: "Missing data" }, { status: 400 })

    const today = getUgandaDateString()
    const bookIdStr = String(bookId)
    const txId = `${phone}:${today}:${bookIdStr}:${action}`
    const idemKey = `idem:${txId}`

    console.log(`[${reqId}] START`, {phone, bookIdStr, action, txId, idemKey})

    const user = await redis.hgetall(`user:${phone}`)
    if (!user?.phone) return NextResponse.json({ error: "User profile missing" }, { status: 404 })

    const vip = toNum(user.vip)
    const vipConfig = VIPS[vip]
    if (!vipConfig) return NextResponse.json({ error: "Invalid VIP level" }, { status: 400 })

    const paymentAmount = vipConfig.perBook
    const nowMs = String(Date.now())
    const tx = JSON.stringify({ id: txId, type: 'daily_income', bookId: bookIdStr, amount: paymentAmount, createdAt: nowMs, status: 'success', phone })

    const res = await redis.eval(
      SUBMIT_LUA,
      [`book:${phone}:${today}:${bookIdStr}`, `user:${phone}`, `tx:${phone}`, `book_submission:${txId}`, `books:${phone}:${today}`, idemKey],
      [action, today, bookIdStr, String(paymentAmount), tx, txId, String(vipConfig.books), nowMs, title || '', cover || '']
    )

    console.log(`[${reqId}] LUA_RES`, res) // <-- THIS IS THE PROOF

    if (res[0] === 0) {
      if (res[1] === 'ALREADY_PAID') return NextResponse.json({ error: 'Already submitted', debug: res[2] }, { status: 409 })
      if (res[1] === 'DAILY_LIMIT') return NextResponse.json({ error: "TODAY'S BOOKS ARE DONE", debug: res[2] }, { status: 400 })
      return NextResponse.json({ error: res[1], debug: res[2] }, { status: 400 })
    }

    const updatedUser = await redis.hgetall(`user:${phone}`)
    return NextResponse.json({ success: true, earned: paymentAmount, txId, debug: res[2], user: {...updatedUser, availableBalance: toNum(updatedUser.availableBalance), dailyIncome: toNum(updatedUser.dailyIncome), books_read_today: toNum(updatedUser.books_read_today), vip: toNum(updatedUser.vip) } }, { headers: { 'Cache-Control': 'no-store' } })

  } catch (error) {
    console.error(`[${reqId}] FATAL`, error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}