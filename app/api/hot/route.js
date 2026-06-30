import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = Redis.fromEnv();
const toNum = (v, f = 0) => { const n = Number(v); return Number.isNaN(n) ? f : n; };

const getTodayKey = (phone) => {
  const tz = 'Africa/Kampala';
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: tz }));
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `tx:${phone}:${yy}-${mm}-${dd}`; // <- Redis List key
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    if (!phone) return NextResponse.json({ success: false, error: "Missing phone" }, { status: 400 });

    const rootUserKey = `user:${phone}`;
    const todayKey = getTodayKey(phone);

    console.log('[HOT GET] Reading profile:', rootUserKey, 'and daily:', todayKey);

    const [userProfile, daily, history] = await Promise.all([ // <- ADDED lrange
      redis.hgetall(rootUserKey),
      redis.hgetall(todayKey),
      redis.lrange(todayKey, 0, -1) // <- CHANGED: Get list, not hgetall.hot_history
    ]);
    
    if (!userProfile || Object.keys(userProfile).length === 0) {
      return NextResponse.json({ success: true, wallet: 0, ongoing: [], expired: [], history: [] });
    }

    const wallet = toNum(userProfile.availableBalance);
    const ongoing = JSON.parse(daily?.hot_ongoing || '[]');
    const expired = JSON.parse(daily?.hot_expired || '[]');
    const parsedHistory = history.map(h => JSON.parse(h)); // <- Parse list items

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
    const todayKey = getTodayKey(phone);
    console.log('[HOT POST] Action:', action, 'Keys Profile:', rootUserKey, 'Daily:', todayKey);

    const [userProfile, dailyData] = await Promise.all([
      redis.hgetall(rootUserKey),
      redis.hgetall(todayKey)
    ]);

    if (!userProfile || Object.keys(userProfile).length === 0) {
      return NextResponse.json({ success: false, error: "User account not found" }, { status: 404 });
    }
    
    let wallet = toNum(userProfile.availableBalance);
    let ongoing = JSON.parse(dailyData?.hot_ongoing || '[]');
    let expired = JSON.parse(dailyData?.hot_expired || '[]');

    if (action === 'BUY_HOT') {
      const price = toNum(payload.price);
      if (wallet < price) {
        return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 });
      }

      wallet = wallet - price;
      ongoing.push(payload.newHotInstance);
      
      const txItem = JSON.stringify({ // <- CHANGED: Build item for list
        id: crypto.randomUUID(),
        type: 'buy_hot',
        amount: String(-price),
        note: `Bought share ${payload.newHotInstance?.title || payload.hotId}`, // <- "share" not "Hot"
        status: 'completed',
        createdAt: new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).replace(',', '').slice(0,16) // <- yy-mm-dd HH:MM
      });

      await Promise.all([
        redis.hset(rootUserKey, { availableBalance: String(wallet) }),
        redis.hset(todayKey, { hot_ongoing: JSON.stringify(ongoing) }),
        redis.lpush(todayKey, txItem) // <- CHANGED: LPUSH to list
      ]);

      const history = await redis.lrange(todayKey, 0, -1);
      return NextResponse.json({ success: true, wallet, history: history.map(h => JSON.parse(h)) });
    }

    if (action === 'COLLECT_HOT') {
      const hot = ongoing.find(i => i.hotId === payload.hotId);
      if (!hot) return NextResponse.json({ success: false, error: "Hot not found" }, { status: 404 });

      const payout = toNum(hot.expectedReturn);
      wallet = wallet + payout;

      ongoing = ongoing.filter(i => i.hotId !== payload.hotId);
      expired.push(hot);
      
      const txItem = JSON.stringify({ // <- CHANGED: Build item for list
        id: crypto.randomUUID(),
        type: 'collect_hot',
        amount: String(payout),
        note: `Collected share ${hot.title}`, // <- "share" not "Hot"
        status: 'completed',
        createdAt: new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).replace(',', '').slice(0,16) // <- yy-mm-dd HH:MM
      });

      await Promise.all([
        redis.hset(rootUserKey, { availableBalance: String(wallet) }),
        redis.hset(todayKey, { hot_ongoing: JSON.stringify(ongoing), hot_expired: JSON.stringify(expired) }),
        redis.lpush(todayKey, txItem) // <- CHANGED: LPUSH to list
      ]);

      const history = await redis.lrange(todayKey, 0, -1);
      return NextResponse.json({ success: true, wallet, history: history.map(h => JSON.parse(h)) });
    }

    return NextResponse.json({ success: false, error: "Action error" }, { status: 400 });
  } catch (err) {
    console.error('[HOT POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}