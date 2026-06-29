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
    const { phone, bookId } = await request.json();
    if (!phone ||!bookId) {
      return NextResponse.json({ error: 'Missing phone or bookId' }, { status: 400 });
    }

    const date = getUgandaDateString();
    const bookKey = `book:${phone}:${date}:${bookId}`;
    const userKey = `user:${phone}`;
    const txKey = `tx:${phone}:${date}`;

    // Block double submit
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
      id: makeId(),
      type: 'book_income', // <- FIX: separate from deposits
      amount: payout,
      bookId: bookId,
      vipLevel: vipLevel,
      status: 'completed',
      createdAt: new Date().toISOString(),
      note: `Book ${bookId} income`
    };

    const pipe = redis.pipeline();
    pipe.hset(bookKey, { status: 'submitted', submittedAt: new Date().toISOString() }); // <- FIX: matches front filter + timestamp
    pipe.hincrbyfloat(userKey, 'availableBalance', payout); // <- only availableBalance
    pipe.lpush(txKey, JSON.stringify(tx));
    const results = await pipe.exec();

    return NextResponse.json({ success: true, availableBalance: results[1][1] });

  } catch (error) {
    console.error('API /books/submit Error:', error);
    return NextResponse.json({ error: 'Submit failed' }, { status: 500 });
  }
}