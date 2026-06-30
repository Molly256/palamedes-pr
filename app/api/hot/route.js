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
  return `user:${phone}:${yy}-${mm}-${dd}`;
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    if (!phone) return NextResponse.json({ success: false, error: "Missing phone" }, { status: 400 });

    const rootUserKey = `user:${phone}`;
    const todayKey = getTodayKey(phone);

    console.log('[HOT GET] Reading profile:', rootUserKey, 'and daily:', todayKey);

    // Read profile balance and daily records concurrently
    const [userProfile, daily] = await Promise.all([
      redis.hgetall(rootUserKey),
      redis.hgetall(todayKey)
    ]);
    
    // Check if the actual user profile exists
    if (!userProfile || Object.keys(userProfile).length === 0) {
      console.log('[HOT GET] User account missing:', rootUserKey);
      return NextResponse.json({ success: true, wallet: 0, ongoing: [], expired: [], history: [] });
    }

    // Extract balance from root profile hash map
    const wallet = toNum(userProfile.availableBalance);
    
    // Extract investment blocks from tracking timeline
    const ongoing = JSON.parse(daily?.hot_ongoing || '[]');
    const expired = JSON.parse(daily?.hot_expired || '[]');
    const history = JSON.parse(daily?.hot_history || '[]');

    return NextResponse.json({ success: true, wallet, ongoing, expired, history });
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
    let history = JSON.parse(dailyData?.hot_history || '[]');

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

      // Write changes back split across both distinct database objects
      await Promise.all([
        redis.hset(rootUserKey, { availableBalance: String(wallet) }),
        redis.hset(todayKey, {
          hot_ongoing: JSON.stringify(ongoing),
          hot_history: JSON.stringify(history)
        })
      ]);

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

      // Write payouts back split across both distinct database objects
      await Promise.all([
        redis.hset(rootUserKey, { availableBalance: String(wallet) }),
        redis.hset(todayKey, {
          hot_ongoing: JSON.stringify(ongoing),
          hot_expired: JSON.stringify(expired),
          hot_history: JSON.stringify(history)
        })
      ]);

      return NextResponse.json({ success: true, wallet });
    }

    return NextResponse.json({ success: false, error: "Action error" }, { status: 400 });
  } catch (err) {
    console.error('[HOT POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}