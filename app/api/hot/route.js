import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ success: false, error: "Missing identity" }, { status: 400 });

    const availableBalance = await redis.get(`user:${userId}:hot_availableBalance`);
    const ongoing = await redis.get(`user:${userId}:hot_ongoing`) || [];
    const expired = await redis.get(`user:${userId}:hot_expired`) || [];
    const history = await redis.get(`user:${userId}:hot_history`) || [];

    return NextResponse.json({ 
      success: true, 
      availableBalance, // <- only this name
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

    const availableBalanceKey = `user:${userId}:hot_availableBalance`; // <- renamed
    const ongoingKey = `user:${userId}:hot_ongoing`;
    const expiredKey = `user:${userId}:hot_expired`;
    const historyKey = `user:${userId}:hot_history`;

    if (action === 'BUY_HOT') {
      const ongoing = await redis.get(ongoingKey) || [];
      const history = await redis.get(historyKey) || [];

      ongoing.push(payload.newHotInstance);
      history.unshift(payload.newTx);

      const p = redis.pipeline();
      p.set(availableBalanceKey, payload.updatedAvailableBalance); // <- renamed
      p.set(ongoingKey, ongoing);
      p.set(historyKey, history);
      await p.exec();

      return NextResponse.json({ success: true });
    }

    if (action === 'COLLECT_HOT') {
      let ongoing = await redis.get(ongoingKey) || [];
      const expired = await redis.get(expiredKey) || [];
      const history = await redis.get(historyKey) || [];

      ongoing = ongoing.filter(i => i.hotId !== payload.hotId);
      expired.push(payload.hot);
      history.unshift(payload.newTx);

      const p = redis.pipeline();
      p.set(availableBalanceKey, payload.updatedAvailableBalance); // <- renamed
      p.set(ongoingKey, ongoing);
      p.set(expiredKey, expired);
      p.set(historyKey, history);
      await p.exec();

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Action error" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}