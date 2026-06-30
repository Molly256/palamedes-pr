import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = Redis.fromEnv();
const toNum = (v, f = 0) => { const n = Number(v); return Number.isNaN(n) ? f : n; };

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ success: false, error: "Missing identity" }, { status: 400 });

    const availableBalance = toNum(await redis.get(`user:${userId}:hot_availableBalance`));
    const ongoing = await redis.get(`user:${userId}:hot_ongoing`) || [];
    const expired = await redis.get(`user:${userId}:hot_expired`) || [];
    const history = await redis.get(`user:${userId}:hot_history`) || [];

    return NextResponse.json({ 
      success: true, 
      availableBalance, // <- real DB balance as number
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
    const { userId, action, payload } = await request.json();
    if (!userId) return NextResponse.json({ success: false, error: "Missing configuration variables" }, { status: 400 });

    const availableBalanceKey = `user:${userId}:hot_availableBalance`;
    const ongoingKey = `user:${userId}:hot_ongoing`;
    const expiredKey = `user:${userId}:hot_expired`;
    const historyKey = `user:${userId}:hot_history`;

    if (action === 'BUY_HOT') {
      const price = toNum(payload.price); // <- must send price from frontend
      const currentBalance = toNum(await redis.get(availableBalanceKey));
      
      if (currentBalance < price) {
        return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 });
      }

      const ongoing = await redis.get(ongoingKey) || [];
      const history = await redis.get(historyKey) || [];
      const newBalance = currentBalance - price;

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
      p.set(availableBalanceKey, newBalance); // <- deduct in backend
      p.set(ongoingKey, ongoing);
      p.set(historyKey, history);
      await p.exec();

      return NextResponse.json({ success: true, availableBalance: newBalance });
    }

    if (action === 'COLLECT_HOT') {
      let ongoing = await redis.get(ongoingKey) || [];
      const expired = await redis.get(expiredKey) || [];
      const history = await redis.get(historyKey) || [];
      const currentBalance = toNum(await redis.get(availableBalanceKey));

      const hot = ongoing.find(i => i.hotId === payload.hotId);
      const payout = toNum(hot?.payout || 0);
      const newBalance = currentBalance + payout;

      ongoing = ongoing.filter(i => i.hotId !== payload.hotId);
      expired.push(payload.hot);
      history.unshift(payload.newTx);

      const p = redis.pipeline();
      p.set(availableBalanceKey, newBalance); // <- add payout in backend
      p.set(ongoingKey, ongoing);
      p.set(expiredKey, expired);
      p.set(historyKey, history);
      await p.exec();

      return NextResponse.json({ success: true, availableBalance: newBalance });
    }

    return NextResponse.json({ success: false, error: "Action error" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}