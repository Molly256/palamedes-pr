import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { randomUUID } from 'crypto';

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

    if (await redis.hget(bookKey, 'status') === 'submitted') {
      return NextResponse.json({ error: 'Already submitted' }, { status: 409 });
    }

    const vipLevel = Number(await redis.hget(userKey, 'vip') || 0);
    const vipData = VIP_CONFIG[vipLevel];
    if (!vipData) {
      return NextResponse.json({ error: 'VIP not open' }, { status: 403 });
    }

    const payout = vipData.perBook;

    const tx = {
      id: randomUUID(),
      type: 'book_income',
      amount: payout,
      bookId: bookId,
      vipLevel: vipLevel,
      status: 'completed',
      createdAt: new Date().toISOString()
    };

    // ONLY availableBalance
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