export const runtime = 'nodejs'; 
export const dynamic = 'force-dynamic';

import { Redis } from '@upstash/redis'; 
import { NextResponse } from 'next/server';
import fs from 'fs'; 
import path from 'path'; 
import { VIPS } from '@/app/config/vips';

const redis = Redis.fromEnv();
let CACHED_VALID_BOOKS = null;

function getValidBooksCached() {
  if (CACHED_VALID_BOOKS) return CACHED_VALID_BOOKS;
  try {
    const booksPath = path.join(process.cwd(), 'app/data/books.json');
    const coversPath = path.join(process.cwd(), 'public/books/covers');
    const allBooks = JSON.parse(fs.readFileSync(booksPath, 'utf8'));
    const coverIds = new Set(fs.readdirSync(coversPath).map(f => f.replace(/\.jpg$/i, '')));
    CACHED_VALID_BOOKS = allBooks.filter(b => coverIds.has(String(b.id)));
    return CACHED_VALID_BOOKS;
  } catch (err) {
    return [];
  }
}

function pickRandomBooks(count) {
  const pool = getValidBooksCached();
  if (pool.length === 0) return [];
  const result = [], chosenIndices = new Set(), actualCount = Math.min(count, pool.length);
  while (chosenIndices.size < actualCount) {
    const randIdx = Math.floor(Math.random() * pool.length);
    if (!chosenIndices.has(randIdx)) {
      chosenIndices.add(randIdx);
      result.push(pool[randIdx]);
    }
  }
  return result;
}

const safeParse = (s, f = []) => (!s ? f : typeof s === 'object' ? s : JSON.parse(s));
const getUgandaDateString = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
const getUgandaDateTimeString = () => new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).slice(0, 16).replace(',', ' ');

function assignBooksToUser(phone, vipLevel, today, pipeline) {
  const selectedVip = VIPS[vipLevel];
  const validBooks = pickRandomBooks(selectedVip.books);
  if (validBooks.length === 0) throw new Error('No books found');
  
  validBooks.forEach(b => {
    pipeline.hset('book:' + phone + ':' + today + ':' + b.id, { 
      phone, bookId: String(b.id), vipLevel: String(vipLevel), reward: selectedVip.perBook, 
      title: b.title, cover: '/books/covers/' + b.id + '.jpg', status: 'pending', date: today, createdAt: String(Date.now()) 
    });
    pipeline.sadd('books:' + phone + ':' + today, String(b.id));
  });
  
  return { 
    unlockedBooks: validBooks.map(b => String(b.id)), 
    assignedBooksMeta: validBooks.map(b => ({ id: String(b.id), title: b.title, cover: '/books/covers/' + b.id + '.jpg', reward: selectedVip.perBook })) 
  };
}

export async function GET() { 
  return NextResponse.json({ success: true, levels: Object.keys(VIPS).map(k => Object.assign({ level: Number(k) }, VIPS[k])) }); 
}

export async function POST(req) {
  try {
    const body = await req.json(), phone = body.phone, action = body.action, payload = body.payload;
    if (!phone || action !== 'BUY_VIP') return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 });
    
    const vipLevel = payload?.vipLevel;
    if (!vipLevel || !VIPS[vipLevel] || vipLevel > 3) return NextResponse.json({ success: false, message: 'Invalid level' }, { status: 400 });
    
    const userKey = 'user:' + phone, user = await redis.hgetall(userKey);
    if (!user || !user.phone) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    
    const currentVip = Number(user.vip || 0);
    if (vipLevel <= currentVip) return NextResponse.json({ success: false, message: 'Already owned' }, { status: 400 });
    
    const currentPricePaid = Number(user.vipPricePaid || 0), upgradeCost = VIPS[vipLevel].price, currentBalance = Number(user.availableBalance || 0);
    if (currentBalance < upgradeCost) return NextResponse.json({ success: false, message: 'Insufficient Balance' }, { status: 400 });
    
    const isFirst = user.hasBoughtVip !== 'true' && user.hasBoughtVip !== true;
    const dateStr = getUgandaDateString(), timeStr = getUgandaDateTimeString(), historyKey = 'tx:' + phone + ':history', pipeline = redis.pipeline();
    
    // --- UGANDA WEEKEND RESTRICTION CHECK ---
    const ugDay = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Kampala" })).getDay();
    const isUgandaWeekend = ugDay === 0 || ugDay === 6; 
    const shouldAssignBooks = payload?.assignBooks !== false && !isUgandaWeekend;

    let unlockedBooks = [], assignedBooksMeta = [];
    if (isFirst) {
      if (shouldAssignBooks) {
        const assignResult = assignBooksToUser(phone, vipLevel, dateStr, pipeline);
        unlockedBooks = assignResult.unlockedBooks;
        assignedBooksMeta = assignResult.assignedBooksMeta;
      }
    } else {
      unlockedBooks = safeParse(user.unlockedBooks);
    }
      
    let newBalance = currentBalance - upgradeCost + (isFirst ? 0 : currentPricePaid);

    if (!isFirst) {
      pipeline.lpush(historyKey, JSON.stringify({ id: 'rf_' + Date.now(), type: 'refund_vip', amount: String(currentPricePaid), note: 'VIP ' + currentVip + ' Refund', status: 'success', createdAt: timeStr }));
    }
    pipeline.lpush(historyKey, JSON.stringify({ id: 'by_' + Date.now(), type: 'buy_vip', amount: String(-upgradeCost), note: VIPS[vipLevel].name + ' Purchase', status: 'success', createdAt: timeStr }));
    
    pipeline.hset(userKey, { 
      vip: String(vipLevel), vipPricePaid: String(upgradeCost), availableBalance: String(newBalance), hasBoughtVip: 'true', 
      vipExpiry: new Date(Date.now() + 31536000000).toISOString(), unlockedBooks: JSON.stringify(unlockedBooks), 
      completedBooks: '[]', books_read_today: '0', dailyIncome: '0', lastResetDate: dateStr, vip_bought_date: dateStr 
    });
    
    await pipeline.exec();
    if (isFirst) await processHierarchicalCommissions(phone, vipLevel);
    
    return NextResponse.json({ success: true, user: Object.assign({}, user, { vip: vipLevel, availableBalance: newBalance, unlockedBooks }), books: assignedBooksMeta });
  } catch (err) { 
    return NextResponse.json({ success: false, message: err.message }, { status: 500 }); 
  }
}

async function processHierarchicalCommissions(buyerPhone, buyerVipLevel) {
  try {
    const vipAmts = { 1: 80000, 2: 250000, 3: 790000 }, timeStr = getUgandaDateTimeString();
    const rates = [0.05, 0.02, 0.01], labels = ['A', 'B', 'C'], typeFlags = ['team_a_payout', 'team_b_payout', 'team_c_payout'];
    
    const parent = await redis.hget('user:' + buyerPhone, 'invited_by');
    if (!parent || !/^07\d{8}$/.test(String(parent).trim())) return;
    const cleanParent = String(parent).trim();

    const grandparent = await redis.hget('user:' + cleanParent, 'invited_by');
    const cleanGrandparent = grandparent && /^07\d{8}$/.test(String(grandparent).trim()) ? String(grandparent).trim() : null;

    let greatGrandparent = null;
    if (cleanGrandparent) {
      const ggrand = await redis.hget('user:' + cleanGrandparent, 'invited_by');
      greatGrandparent = ggrand && /^07\d{8}$/.test(String(ggrand).trim()) ? String(ggrand).trim() : null;
    }

    const chain = [cleanParent, cleanGrandparent, greatGrandparent];
    const uplineData = await Promise.all(chain.map(p => p ? redis.hmget('user:' + p, 'vip', 'hasBoughtVip') : Promise.resolve(null)));
    const commissionPipeline = redis.pipeline();
    let hasQueuedOps = false;

    for (let i = 0; i < 3; i++) {
      const uplinePhone = chain[i];
      if (!uplinePhone) continue;

      const userData = uplineData[i] || {}, uplineVip = Number(userData.vip || 0), hasBoughtVipStatus = userData.hasBoughtVip;
      if (hasBoughtVipStatus !== 'true' && hasBoughtVipStatus !== true) continue;

      if (uplineVip > 0) {
        const reward = Math.floor((vipAmts[Math.min(uplineVip, buyerVipLevel)] || 0) * rates[i]);
        if (reward > 0) {
          hasQueuedOps = true;
          commissionPipeline.lpush('tx:' + uplinePhone + ':history', JSON.stringify({ 
            id: 'tx_' + Date.now() + '_' + labels[i] + '_' + Math.random().toString(36).slice(2, 5), 
            type: typeFlags[i], label: 'commission', amount: String(reward), note: 'Invitation Rewards (Team ' + labels[i] + ': ' + buyerPhone + ')', status: 'success', createdAt: timeStr 
          }));
          commissionPipeline.hincrby('user:' + uplinePhone, 'availableBalance', reward);
        }
      }
    }
    if (hasQueuedOps) await commissionPipeline.exec();
  } catch (err) {}
}