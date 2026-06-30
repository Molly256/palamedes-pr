import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = Redis.fromEnv();
const toNum = (v, f = 0) => { const n = Number(v); return Number.isNaN(n) ? f : n; };

const getTodayDateStr = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Kampala" }));
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};
const txListKey = (phone) => `tx:${phone}:${getTodayDateStr()}`; 
const txHashKey = (phone) => `tx:${phone}:${getTodayDateStr()}:data`; 

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    if (!phone) return NextResponse.json({ success: false, error: "Missing phone" }, { status: 400 });

    const rootUserKey = `user:${phone}`;
    const listKey = txListKey(phone);
    const hashKey = txHashKey(phone);

    console.log('[HOT GET] profile:', rootUserKey, 'list:', listKey, 'hash:', hashKey);

    const [userProfile, dailyHash, history] = await Promise.all([
      redis.hgetall(rootUserKey),
      redis.hgetall(hashKey),
      redis.lrange(listKey, 0, -1)
    ]);
    
    if (!userProfile || Object.keys(userProfile).length === 0) {
      return NextResponse.json({ success: true, wallet: 0, ongoing: [], expired: [], history: [] });
    }

    const wallet = toNum(userProfile.availableBalance);
    const ongoing = JSON.parse(dailyHash?.hot_ongoing || '[]');
    const expired = JSON.parse(dailyHash?.hot_expired || '[]');
    // FIXED: Don't parse. Upstash already gave us objects
    const parsedHistory = Array.isArray(history) ? history : [];

    return NextResponse.json({ success: true, wallet, ongoing, expired, history: parsedHistory });
  } catch (err) {
    console.error('[HOT GET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { phone, action, payload } = await request.json();
    if (!phone) return NextResponse.json({ success: false, error: "Missing phone" }, { status: 400 });

    const rootUserKey = `user:${phone}`;
    const listKey = txListKey(phone);
    const hashKey = txHashKey(phone);
    console.log('[HOT POST] Action:', action, 'Profile:', rootUserKey, 'List:', listKey, 'Hash:', hashKey);

    const [userProfile, dailyHash] = await Promise.all([
      redis.hgetall(rootUserKey),
      redis.hgetall(hashKey)
    ]);

    if (!userProfile || Object.keys(userProfile).length === 0) {
      return NextResponse.json({ success: false, error: "User account not found" }, { status: 404 });
    }
    
    let wallet = toNum(userProfile.availableBalance);
    let ongoing = JSON.parse(dailyHash?.hot_ongoing || '[]');
    let expired = JSON.parse(dailyHash?.hot_expired || '[]');

    if (action === 'BUY_HOT') {
      const price = toNum(payload.price);
      if (wallet < price) return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 });

      wallet = wallet - price;
      ongoing.push(payload.newHotInstance);
      
      const txItem = { // <- CHANGED: Push object, not string
        id: crypto.randomUUID(),
        type: 'buy_hot',
        amount: String(-price),
        note: `Bought share ${payload.newHotInstance?.title || payload.hotId}`,
        status: 'completed',
        createdAt: new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).replace(',', '').slice(0,16)
      };

      await Promise.all([
        redis.hset(rootUserKey, { availableBalance: String(wallet) }),
        redis.hset(hashKey, { hot_ongoing: JSON.stringify(ongoing) }),
        redis.lpush(listKey, txItem) // <- Upstash will stringify it
      ]);

      const history = await redis.lrange(listKey, 0, -1);
      return NextResponse.json({ success: true, wallet, history }); // <- no map/parse
    }

    if (action === 'COLLECT_HOT') {
      const hot = ongoing.find(i => i.hotId === payload.hotId);
      if (!hot) return NextResponse.json({ success: false, error: "Hot not found" }, { status: 404 });

      const payout = toNum(hot.expectedReturn);
      wallet = wallet + payout;
      ongoing = ongoing.filter(i => i.hotId !== payload.hotId);
      expired.push(hot);
      
      const txItem = { // <- CHANGED: Push object
        id: crypto.randomUUID(),
        type: 'collect_hot',
        amount: String(payout),
        note: `Collected share ${hot.title}`,
        status: 'completed',
        createdAt: new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).replace(',', '').slice(0,16)
      };

      await Promise.all([
        redis.hset(rootUserKey, { availableBalance: String(wallet) }),
        redis.hset(hashKey, { hot_ongoing: JSON.stringify(ongoing), hot_expired: JSON.stringify(expired) }),
        redis.lpush(listKey, txItem)
      ]);

      const history = await redis.lrange(listKey, 0, -1);
      return NextResponse.json({ success: true, wallet, history }); // <- no map/parse
    }

    return NextResponse.json({ success: false, error: "Action error" }, { status: 400 });
  } catch (err) {
    console.error('[HOT POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}