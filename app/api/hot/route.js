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
  return `user:${phone}:${yy}-${mm}-${dd}`; // <- your key format
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    if (!phone) return NextResponse.json({ success: false, error: "Missing phone" }, { status: 400 });

    const todayKey = getTodayKey(phone);
    const daily = await redis.hgetall(todayKey); // <- READ daily key
    if (!daily) return NextResponse.json({ success: false, error: "No daily record" }, { status: 404 });

    const wallet = toNum(daily.availableBalance); // <- your field name
    const ongoing = JSON.parse(daily.hot_ongoing || '[]');
    const expired = JSON.parse(daily.hot_expired || '[]');
    const history = JSON.parse(daily.hot_history || '[]');

    return NextResponse.json({ 
      success: true, 
      wallet, // <- frontend expects this
      ongoing, 
      expired, 
      history 
    });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { phone, action, payload } = await request.json();
    if (!phone) return NextResponse.json({ success: false, error: "Missing phone" }, { status: 400 });

    const todayKey = getTodayKey(phone);
    const daily = await redis.hgetall(todayKey) || {};
    
    let wallet = toNum(daily.availableBalance);
    let ongoing = JSON.parse(daily.hot_ongoing || '[]');
    let expired = JSON.parse(daily.hot_expired || '[]');
    let history = JSON.parse(daily.hot_history || '[]');

    if (action === 'BUY_HOT') {
      const price = toNum(payload.price); 
      
      if (wallet < price) {
        return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 });
      }

      wallet = wallet - price;

      ongoing.push(payload.newHotInstance);
      history.unshift({
        id: crypto.randomUUID(),
        type: 'buy_hot',
        amount: String(-price),
        note: `Bought Hot ${payload.newHotInstance?.title || payload.hotId}`,
        status: 'completed',
        createdAt: new Date().toISOString().slice(0,10).replaceAll('-','/')
      });

      const p = redis.pipeline();
      p.hset(todayKey, { // <- WRITE to daily key
        availableBalance: String(wallet), // <- your field name
        hot_ongoing: JSON.stringify(ongoing),
        hot_history: JSON.stringify(history)
      });
      await p.exec();

      return NextResponse.json({ success: true, wallet });
    }

    if (action === 'COLLECT_HOT') {
      const hot = ongoing.find(i => i.hotId === payload.hotId);
      if (!hot) return NextResponse.json({ success: false, error: "Hot not found" }, { status: 404 });

      const payout = toNum(hot.expectedReturn);
      wallet = wallet + payout;

      ongoing = ongoing.filter(i => i.hotId !== payload.hotId);
      expired.push(hot);
      history.unshift({
        id: crypto.randomUUID(),
        type: 'collect_hot',
        amount: String(payout),
        note: `Collected ${hot.title}`,
        status: 'completed',
        createdAt: new Date().toISOString().slice(0,10).replaceAll('-','/')
      });

      const p = redis.pipeline();
      p.hset(todayKey, {
        availableBalance: String(wallet),
        hot_ongoing: JSON.stringify(ongoing),
        hot_expired: JSON.stringify(expired),
        hot_history: JSON.stringify(history)
      });
      await p.exec();

      return NextResponse.json({ success: true, wallet });
    }

    return NextResponse.json({ success: false, error: "Action error" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}