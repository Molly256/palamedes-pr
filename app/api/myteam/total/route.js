export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const toNum = (v, f = 0) => {
  if (v === undefined || v === null) return f;
  const n = Number(v);
  return Number.isNaN(n) ? f : n;
};

/**
 * GET: Fetches actual user live data directly out from Upstash Redis hashes and lists
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'User ID parameter is required' }, { status: 400 });
    }

    const userKey = `user:${userId}`;

    // Fetch the balance, transaction log list array, ongoing shares, and expired items in parallel
    const [rawBalance, rawHistory, rawOngoing, rawExpired] = await Promise.all([
      redis.hget(userKey, 'available_balance'),
      redis.lrange(`user:${userId}:tx_history`, 0, -1),
      redis.hgetall(`user:${userId}:ongoing_hots`),
      redis.hgetall(`user:${userId}:expired_hots`)
    ]);

    // Parse data blocks safely into arrays
    const history = (rawHistory || []).map(item => (typeof item === 'string' ? JSON.parse(item) : item));
    const ongoing = rawOngoing ? Object.values(rawOngoing).map(item => (typeof item === 'string' ? JSON.parse(item) : item)) : [];
    const expired = rawExpired ? Object.values(rawExpired).map(item => (typeof item === 'string' ? JSON.parse(item) : item)) : [];

    return NextResponse.json({
      success: true,
      availableBalance: toNum(rawBalance, 0),
      history,
      ongoing,
      expired
    }, { status: 200 });

  } catch (error) {
    console.error('Fatal API endpoint crash in GET /api/hot:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST: Handles immediate balance deductions, logs transaction history, and pushes to ongoing sections
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { userId, action, payload } = body;

    if (!userId || !action || !payload) {
      return NextResponse.json({ success: false, error: 'Payload properties are invalid' }, { status: 400 });
    }

    const userKey = `user:${userId}`;
    
    // Create an atomic pipeline transaction block for Upstash
    const pipeline = redis.pipeline();

    if (action === 'BUY_HOT') {
      const { updatedAvailableBalance, newHotInstance, newTx } = payload;

      // Deduct balance, add transaction record, and store to ongoing shares
      pipeline.hset(userKey, { available_balance: updatedAvailableBalance });
      pipeline.lpush(`user:${userId}:tx_history`, JSON.stringify(newTx));
      pipeline.hset(`user:${userId}:ongoing_hots`, { [newHotInstance.hotId]: JSON.stringify(newHotInstance) });

    } else if (action === 'COLLECT_HOT') {
      const { updatedAvailableBalance, hotId, hot, newTx } = payload;

      // Add collected profits, log transaction, remove from ongoing, and push to expired
      pipeline.hset(userKey, { available_balance: updatedAvailableBalance });
      pipeline.lpush(`user:${userId}:tx_history`, JSON.stringify(newTx));
      pipeline.hdel(`user:${userId}:ongoing_hots`, hotId);
      pipeline.hset(`user:${userId}:expired_hots`, { [hotId]: JSON.stringify(hot) });
			
    } else {
      return NextResponse.json({ success: false, error: 'Action type requested is unhandled' }, { status: 400 });
    }

    // Execute pipeline queries atomically on Upstash
    await pipeline.exec();

    return NextResponse.json({ success: true, message: 'Database synced successfully' }, { status: 200 });

  } catch (error) {
    console.error('Fatal API endpoint crash in POST /api/hot:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}