export const runtime = 'nodejs'; export const dynamic = 'force-dynamic'
import { Redis } from '@upstash/redis'; import { NextResponse } from 'next/server'
import fs from 'fs/promises'; import path from 'path'; import crypto from 'crypto'
import { VIPS } from '@/app/config/vips'
const redis = Redis.fromEnv(), safeParse = (s, f = []) => { if (!s) return f; return typeof s === 'object' ? s : JSON.parse(s) }
function shuffle(a) { let r = [...a]; for (let i = r.length - 1; i > 0; i--) { let j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]] } return r }
const getUgandaDateString = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
const getUgandaDateTimeString = () => new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).slice(0,16).replace(',', ' ')

async function assignBooksToUser(phone, vipLevel, today, pipeline) {
  const selectedVip = VIPS[vipLevel], allBooks = await fs.readFile(path.join(process.cwd(), 'app/data/books.json'), 'utf8').then(JSON.parse)
  const coverFiles = await fs.readdir(path.join(process.cwd(), 'public/books/covers')), coverIds = new Set(coverFiles.map(f => f.replace(/\.jpg$/i, '')))
  const validBooks = allBooks.filter(b => coverIds.has(String(b.id))); if (validBooks.length === 0) throw new Error('No books found')
  const assigned = shuffle(validBooks).slice(0, Math.min(selectedVip.books, validBooks.length))
  assigned.forEach(b => {
    pipeline.hset(`book:${phone}:${today}:${b.id}`, { phone, bookId: String(b.id), vipLevel: String(vipLevel), reward: selectedVip.perBook, title: b.title, cover: `/books/covers/${b.id}.jpg`, status: 'pending', date: today, createdAt: String(Date.now()) })
    pipeline.sadd(`books:${phone}:${today}`, String(b.id))
  })
  return { unlockedBooks: assigned.map(b => String(b.id)), assignedBooksMeta: assigned.map(b => ({ id: String(b.id), title: b.title, cover: `/books/covers/${b.id}.jpg`, reward: selectedVip.perBook })) }
}

export async function GET() { return NextResponse.json({ success: true, levels: Object.keys(VIPS).map(k => ({ level: Number(k), ...VIPS[k] })) }) }

export async function POST(req) {
  try {
    const { phone, action, payload } = await req.json(); if (!phone || action !== 'BUY_VIP') return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })
    const vipLevel = payload?.vipLevel; if (!vipLevel || !VIPS[vipLevel] || vipLevel > 3) return NextResponse.json({ success: false, message: 'Invalid or locked VIP level' }, { status: 400 })
    const userKey = `user:${phone}`, user = await redis.hgetall(userKey); if (!user?.phone) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    const currentVip = Number(user.vip || 0); if (vipLevel <= currentVip) return NextResponse.json({ success: false, message: 'Already owned' }, { status: 400 })
    const currentPricePaid = Number(user.vipPricePaid || 0), upgradeCost = VIPS[vipLevel].price, currentBalance = Number(user.availableBalance || 0)
    if (currentBalance < upgradeCost) return NextResponse.json({ success: false, message: 'Insufficient Balance' }, { status: 400 })
    
    const isFirst = user.hasBoughtVip !== 'true' && user.hasBoughtVip !== true, dateStr = getUgandaDateString(), timeStr = getUgandaDateTimeString(), txKey = `tx:${phone}:${dateStr}`, pipeline = redis.pipeline()
    let { unlockedBooks, assignedBooksMeta } = isFirst ? await assignBooksToUser(phone, vipLevel, dateStr, pipeline) : { unlockedBooks: safeParse(user.unlockedBooks), assignedBooksMeta: [] }
    let newBalance = currentBalance - upgradeCost + (isFirst ? 0 : currentPricePaid)

    if (!isFirst) pipeline.lpush(txKey, JSON.stringify({ id: `rf_${Date.now()}`, type: 'refund_vip', amount: String(currentPricePaid), note: `VIP ${currentVip} Refund`, status: 'completed', createdAt: timeStr }))
    pipeline.lpush(txKey, JSON.stringify({ id: `by_${Date.now()}`, type: 'buy_vip', amount: String(-upgradeCost), note: `${VIPS[vipLevel].name} Purchase`, status: 'completed', createdAt: timeStr }))
    
    pipeline.hset(userKey, { vip: String(vipLevel), vipPricePaid: String(upgradeCost), availableBalance: String(newBalance), hasBoughtVip: 'true', vipExpiry: new Date(Date.now() + 31536000000).toISOString(), unlockedBooks: JSON.stringify(unlockedBooks), completedBooks: '[]', books_read_today: '0', dailyIncome: '0', lastResetDate: dateStr, vip_bought_date: dateStr })
    await pipeline.exec()
    
    if (isFirst) await processHierarchicalCommissions(phone, vipLevel)
    return NextResponse.json({ success: true, user: { ...user, vip: vipLevel, availableBalance: newBalance, unlockedBooks }, books: assignedBooksMeta })
  } catch (err) { return NextResponse.json({ success: false, message: err.message }, { status: 500 }) }
}

// ULTRA-SHORT LOOP ENGINE FOR TEAM A, B, AND C PAYOUTS
async function processHierarchicalCommissions(buyerPhone, buyerVipLevel) {
  try {
    const vipAmts = { 1: 80000, 2: 250000, 3: 790000, 4: 1000000, 5: 1500000, 6: 2100000, 7: 4000000, 8: 4600000, 9: 5000000, 10: 8000000 }
    const today = getUgandaDateString(), timeStr = getUgandaDateTimeString(), rates = [0.05, 0.02, 0.01], labels = ['A', 'B', 'C']
    let currentBuyer = buyerPhone

    for (let i = 0; i < 3; i++) {
      const upline = await redis.hget(`user:${currentBuyer}`, 'invited_by'); if (!upline) break
      const uplineVip = Number(await redis.hget(`user:${upline}`, 'vip') || 0)
      if (uplineVip > 0) {
        const reward = Math.floor((vipAmts[Math.min(uplineVip, buyerVipLevel)] || 0) * rates[i])
        if (reward > 0) {
          await redis.lpush(`tx:${upline}:${today}`, JSON.stringify({ id: `tx_${Date.now()}_${labels[i]}`, type: 'commission', amount: String(reward), note: `Invitation Rewards (Team ${labels[i]}: ${buyerPhone})`, status: 'completed', createdAt: timeStr }))
          await redis.hincrbyfloat(`user:${upline}`, 'availableBalance', reward)
        }
      }
      currentBuyer = upline
    }
  } catch (err) { console.error('Commission crash:', err) }
}