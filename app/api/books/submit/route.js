import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const redis = Redis.fromEnv();

// ONLY VIP 1, 2, 3 ARE OPEN. From your screenshot.
const VIP_CONFIG = {
 1: { perBook: 625 },
 2: { perBook: 2000 }, 
 3: { perBook: 6500 },
};

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
}

export async function POST(request) {
  try {
    const { phone, bookId } = await request.json();
    if (!phone ||!bookId) {
      return NextResponse.json({ error: 'Missing phone or bookId' }, { status: 400 });
    }

    const date = getUgandaDateString();
    const bookKey = `book:${phone}:${date}:${bookId}`;
    const userKey = `user:${phone}`;
    const txKey = `tx:${phone}:${date}`;

    // 1. Block double submit
    if (await redis.hget(bookKey, 'status') === 'submitted') {
      return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
    }

    // 2. Get user's VIP level. Only check 1,2,3
    const vipLevel = Number(await redis.hget(userKey, 'vip') || 0);
    const vipData = VIP_CONFIG[vipLevel];
    if (!vipData) {
      return NextResponse.json({ error: 'VIP not open' }, { status: 403 }); // blocks 4-10
    }

    const payout = vipData.perBook;

    // 3. Create TX for Daily Income tab
    const tx = {
      id: randomUUID(),
      type: 'book_income',
      amount: payout,
      bookId: bookId,
      vipLevel: vipLevel,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    // 4. Atomic: mark submitted + add balance + save tx
    const pipe = redis.pipeline();
    pipe.hset(bookKey, { status: 'submitted' });
    pipe.hincrbyfloat(userKey, 'availableBalance', payout);
    pipe.lpush(txKey, JSON.stringify(tx));
    const results = await pipe.exec();
    
    return NextResponse.json({ success: true, availableBalance: results[1][1] });

  } catch (error) {
    console.error('API /books/submit Error:', error);
    return NextResponse.json({ error: 'Submit failed' }, { status: 500 });
  }
}