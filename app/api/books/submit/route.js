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
    const { phone, bookId, action } = await request.json();

    if (!phone || !bookId || !action) {
      return NextResponse.json({ error: 'Missing phone, bookId, or action' }, { status: 400 });
    }

    const date = getUgandaDateString();
    const bookKey = `book:${phone}:${date}:${bookId}`;
    const userKey = `user:${phone}`;
    const txKey = `tx:${phone}:${date}`;
    const incomeKey = `income:${phone}:${date}`; 

    const userExists = await redis.exists(userKey);
    if (!userExists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ----------------------------------------------------
    // ACTION 1: TIMER HITS 0SEC (Mark as Read)
    // ----------------------------------------------------
    if (action === 'read') {
      const currentStatus = await redis.hget(bookKey, 'status') || null;

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
      const currentStatus = await redis.hget(bookKey, 'status') || null;

      if (currentStatus === 'submitted') {
        const currentBal = Number(await redis.hget(userKey, 'availableBalance') || 0);
        return NextResponse.json({ success: true, availableBalance: currentBal, status: 'submitted' });
      }

      if (currentStatus !== 'read') {
        return NextResponse.json({ error: 'Book must be read before submitting' }, { status: 400 });
      }

      const vipLevel = Number(await redis.hget(userKey, 'vip') || 0);
      const vipData = VIP_CONFIG[vipLevel];
      if (!vipData) {
        return NextResponse.json({ error: 'VIP level configuration not open' }, { status: 403 });
      }

      const payout = vipData.perBook;

      // FIXED: Structuring object properties to exactly match your transaction file mapping
      const tx = {
        id: makeId(),
        type: 'book_income', // Becomes 'book income' inside your UI formatter
        amount: String(payout),
        status: 'completed',
        createdAt: String(Date.now()), // FIXED: Changed to ms string so sorting algorithm doesn't break
        phone: phone,
        vipLevel: String(vipLevel),
        bookTitle: `Book ${bookId}` // Populates UI bookTitle field safely
      };

      await redis.hsetnx(userKey, 'availableBalance', 0);

      // Atomic execution via pipeline
      const pipe = redis.pipeline();
      pipe.hset(bookKey, { status: 'submitted', submittedAt: new Date().toISOString() });
      pipe.hincrbyfloat(userKey, 'availableBalance', payout);
      pipe.lpush(txKey, JSON.stringify(tx)); 
      pipe.lpush(incomeKey, JSON.stringify(tx)); 

      const results = await pipe.exec();

      // FIXED: Cleaned Upstash execution check to prevent false 500 crashes
      if (!results || results.length < 4) {
        console.error('Redis pipeline failed to return all operations:', results);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      // Safe extraction of the new balance from the pipeline return index
      const updatedBalance = results[1];

      return NextResponse.json({
        success: true,
        availableBalance: typeof updatedBalance === 'number' ? updatedBalance : Number(updatedBalance),
        status: 'submitted'
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });

  } catch (error) {
    console.error('API /books/submit Error:', error);
    return NextResponse.json({ error: 'Internal system failure' }, { status: 500 });
  }
}