import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const redis = Redis.fromEnv();

const VIP_CONFIG = {
 1: { perBook: 625 },
 2: { perBook: 2000 },
 3: { perBook: 6500 },
};

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
}

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export async function POST(request) {
  try {
    const { phone, bookId, action = 'submit' } = await request.json(); // <- action added
    if (!phone ||!bookId) {
      return NextResponse.json({ error: 'Missing phone or bookId' }, { status: 400 });
    }

    const date = getUgandaDateString();
    const bookKey = `book:${phone}:${date}:${bookId}`;
    const userKey = `user:${phone}`;
    const txKey = `tx:${phone}:${date}`;

    // 1. Check user exists first
    const userExists = await redis.exists(userKey);
    if (!userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ACTION 1: Mark as READ. No money, just status
    if (action === 'read') {
      await redis.hset(bookKey, { status: 'read', readAt: new Date().toISOString() });
      return NextResponse.json({ success: true });
    }

    // ACTION 2: SUBMIT FOR MONEY
    // 2.1 Idempotent: If already submitted, just return current balance. NO 409 = NO BOUNCE
    const currentStatus = await redis.hget(bookKey, 'status');
    if (currentStatus === 'submitted') {
      const currentBal = Number(await redis.hget(userKey, 'availableBalance') || 0);
      return NextResponse.json({ success: true, availableBalance: currentBal });
    }

    const vipLevel = Number(await redis.hget(userKey, 'vip') || 0);
    const vipData = VIP_CONFIG[vipLevel];
    if (!vipData) {
      return NextResponse.json({ error: 'VIP not open' }, { status: 403 });
    }

    const payout = vipData.perBook;

    const tx = {
      id: makeId(),
      type: 'book_income',
      amount: payout,
      bookId: bookId,
      vipLevel: vipLevel,
      status: 'completed',
      createdAt: new Date().toISOString(),
      note: `Book ${bookId} income`
    };

    // 3. Ensure availableBalance field exists before incr
    await redis.hsetnx(userKey, 'availableBalance', 0);

    const pipe = redis.pipeline();
    pipe.hset(bookKey, { status: 'submitted', submittedAt: new Date().toISOString() });
    pipe.hincrbyfloat(userKey, 'availableBalance', payout);
    pipe.lpush(txKey, JSON.stringify(tx));
    const results = await pipe.exec();

    // Check for pipeline errors
    if (results.some(r => r[0])) {
      console.error('Redis pipeline error:', results);
      return NextResponse.json({ error: 'DB write failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, availableBalance: results[1][1] });

  } catch (error) {
    console.error('API /books/submit Error:', error);
    return NextResponse.json({ error: 'Submit failed' }, { status: 500 });
  }
}