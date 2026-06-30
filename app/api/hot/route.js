import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = Redis.fromEnv();
const toNum = (v, f = 0) => { const n = Number(v); return Number.isNaN(n) ? f : n; };

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone'); // <- FIX 1: phone not userId
    if (!phone) return NextResponse.json({ success: false, error: "Missing phone" }, { status: 400 });

    const user = await redis.hgetall(`user:${phone}`); // <- FIX 1: single hash
    if (!user) return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });

    const wallet = toNum(user.wallet); // <- FIX 2: wallet not availableBalance
    const ongoing = JSON.parse(user.hot_ongoing || '[]');
    const expired = JSON.parse(user.hot_expired || '[]');
    const history = JSON.parse(user.hot_history || '[]');

    return NextResponse.json({ 
      success: true, 
      wallet, // <- FIX 2
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
    const { phone, action, payload } = await request.json(); // <- FIX 1: phone
    if (!phone) return NextResponse.json({ success: false, error: "Missing phone" }, { status: 400 });

    const userKey = `user:${phone}`;
    const user = await redis.hgetall(userKey) || {};
    
    let wallet = toNum(user.wallet);
    let ongoing = JSON.parse(user.hot_ongoing || '[]');
    let expired = JSON.parse(user.hot_expired || '[]');
    let history = JSON.parse(user.hot_history || '[]');

    if (action === 'BUY_HOT') {
      const price = toNum(payload.price); 
      
      if (wallet < price) {
        return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 });
      }

      wallet = wallet - price; // <- deduct

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
      p.hset(userKey, { 
        wallet: String(wallet),
        hot_ongoing: JSON.stringify(ongoing),
        hot_history: JSON.stringify(history)
      }); // <- FIX 1: hset on 1 hash
      await p.exec();

      return NextResponse.json({ success: true, wallet }); // <- FIX 2
    }

    if (action === 'COLLECT_HOT') {
      const hot = ongoing.find(i => i.hotId === payload.hotId);
      if (!hot) return NextResponse.json({ success: false, error: "Hot not found" }, { status: 404 });

      const payout = toNum(hot.expectedReturn); // <- FIX 3: use expectedReturn
      wallet = wallet + payout; // <- add payout

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
      p.hset(userKey, { 
        wallet: String(wallet),
        hot_ongoing: JSON.stringify(ongoing),
        hot_expired: JSON.stringify(expired),
        hot_history: JSON.stringify(history)
      });
      await p.exec();

      return NextResponse.json({ success: true, wallet }); // <- FIX 2
    }

    return NextResponse.json({ success: false, error: "Action error" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}