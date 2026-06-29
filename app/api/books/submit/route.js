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
    // Action can now be 'read' (timer finished) or 'submit' (money claimed)
    const { phone, bookId, action } = await request.json();

    if (!phone ||!bookId ||!action) {
      return NextResponse.json({ error: 'Missing phone, bookId, or action' }, { status: 400 });
    }

    const date = getUgandaDateString();
    const bookKey = `book:${phone}:${date}:${bookId}`;
    const userKey = `user:${phone}`;
    const txKey = `tx:${phone}:${date}`;

    // 1. Verify user exists
    const userExists = await redis.exists(userKey);
    if (!userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ----------------------------------------------------
    // ACTION 1: TIMER HITS 0SEC (Mark as Read)
    // ----------------------------------------------------
    if (action === 'read') {
      const currentStatus = await redis.hget(bookKey, 'status') || null; // <- ADDED || null

      // If already submitted, keep it as submitted so they don't lose progress
      if (currentStatus === 'submitted') {
        return NextResponse.json({ success: true, status: 'submitted' });
      }

      await redis.hset(bookKey, {
        status: 'read',
        readAt: new Date().toISOString()
      });

      return NextResponse.json({ success: true, status: 'read' });
    }

    // ----------------------------------------------------
    // ACTION 2: USER TAPS SUBMIT (Claim Money)
    // ----------------------------------------------------
    if (action === 'submit') {
      const currentStatus = await redis.hget(bookKey, 'status') || null; // <- ADDED || null

      // Idempotency: Prevent double spending if they double tap submit
      if (currentStatus === 'submitted') {
        const currentBal = Number(await redis.hget(userKey, 'availableBalance') || 0);
        return NextResponse.json({ success: true, availableBalance: currentBal, status: 'submitted' });
      }

      // Security check: Ensure they actually waited for the 10sec timer first!
      if (currentStatus!== 'read') {
        return NextResponse.json({ error: 'Book must be read before submitting' }, { status: 400 });
      }

      // Fetch VIP Configurations
      const vipLevel = Number(await redis.hget(userKey, 'vip') || 0);
      const vipData = VIP_CONFIG[vipLevel];
      if (!vipData) {
        return NextResponse.json({ error: 'VIP level configuration not open' }, { status: 403 });
      }

      const payout = vipData.perBook;

      // Build transaction object for the "Daily Income" history tab
      const tx = {
        id: makeId(),
        type: 'book_income', // Used by frontend to filter "Daily Income"
        amount: payout,
        bookId: bookId,
        vipLevel: vipLevel,
        status: 'completed',
        createdAt: new Date().toISOString(),
        note: `Book ${bookId} income`
      };

      // Ensure availableBalance field exists to prevent mathematical crashes
      await redis.hsetnx(userKey, 'availableBalance', 0);

      // Atomic execution via pipeline
      const pipe = redis.pipeline();
      pipe.hset(bookKey, { status: 'submitted', submittedAt: new Date().toISOString() });
      pipe.hincrbyfloat(userKey, 'availableBalance', payout);
      pipe.lpush(txKey, JSON.stringify(tx));
      const results = await pipe.exec();

      if (results.some(r => r[0])) {
        console.error('Redis pipeline error:', results);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      // Return the newly updated balance directly from the atomic operation
      return NextResponse.json({
        success: true,
        availableBalance: results[1][1],
        status: 'submitted'
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });

  } catch (error) {
    console.error('API /books/submit Error:', error);
    return NextResponse.json({ error: 'Internal system failure' }, { status: 500 });
  }
}