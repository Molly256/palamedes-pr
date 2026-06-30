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

function safeParse(str, fallback = []) {
  try { return JSON.parse(str || '[]') } catch { return fallback }
}

export async function POST(request) {
  try {
    const { phone, bookId, action } = await request.json();

    if (!phone || !bookId || !action) {
      return NextResponse.json({ error: 'Missing phone, bookId, or action' }, { status: 400 });
    }

    const today = getUgandaDateString();
    const bookKey = `book:${phone}:${today}:${bookId}`;
    const userKey = `user:${phone}`;
    const txKey = `tx:${phone}:${today}`;
    const incomeKey = `income:${phone}:${today}`; 

    const userData = await redis.hgetall(userKey);
    if (!userData || !userData.phone) {
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
        const currentBal = Number(userData.availableBalance || 0);
        return NextResponse.json({ success: true, availableBalance: currentBal, status: 'submitted' });
      }

      if (currentStatus !== 'read') {
        return NextResponse.json({ error: 'Book must be read before submitting' }, { status: 400 });
      }

      const vipLevel = Number(userData.vip || 0);
      const vipData = VIP_CONFIG[vipLevel];
      if (!vipData) {
        return NextResponse.json({ error: 'VIP level configuration not open' }, { status: 403 });
      }

      const payout = vipData.perBook;

      // Handle the completed books array tracking seamlessly
      const currentCompleted = safeParse(userData.completedBooks);
      if (!currentCompleted.includes(String(bookId))) {
        currentCompleted.push(String(bookId));
      }

      const tx = {
        id: makeId(),
        type: 'book_income', 
        amount: String(payout),
        status: 'completed',
        createdAt: String(Date.now()), 
        phone: phone,
        vipLevel: String(vipLevel),
        bookTitle: `Book ${bookId}` 
      };

      // Initialize base parameters safely without erasing current settings
      await redis.hsetnx(userKey, 'availableBalance', '0');
      await redis.hsetnx(userKey, 'books_read_today', '0');
      await redis.hsetnx(userKey, 'dailyIncome', '0');

      const pipe = redis.pipeline();
      
      // Index 0: Update book hash status
      pipe.hset(bookKey, { status: 'submitted', submittedAt: new Date().toISOString() });
      
      // Index 1, 2, 3: Atomic increments avoid out-of-sync calculations
      pipe.hincrbyfloat(userKey, 'availableBalance', payout);
      pipe.hincrby(userKey, 'books_read_today', 1);
      pipe.hincrbyfloat(userKey, 'dailyIncome', payout);
      
      // Index 4: Save tracked books array string
      pipe.hset(userKey, {
        completedBooks: JSON.stringify(currentCompleted)
      });

      // Indexes 5 and 6: Push to history streams
      pipe.lpush(txKey, JSON.stringify(tx)); 
      pipe.lpush(incomeKey, JSON.stringify(tx)); 

      const results = await pipe.exec();

      if (!results || results.length < 7) {
        console.error('Redis pipeline failed:', results);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      // Safely parse pipeline array indices to return back to user view state
      const updatedBalance = Number(results[1]);
      const nextDailyCount = Number(results[2]);

      return NextResponse.json({
        success: true,
        availableBalance: isNaN(updatedBalance) ? (Number(userData.availableBalance || 0) + payout) : updatedBalance,
        status: 'submitted',
        books_read_today: isNaN(nextDailyCount) ? (Number(userData.books_read_today || 0) + 1) : nextDailyCount,
        completedBooks: currentCompleted
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });

  } catch (error) {
    console.error('API /books/submit Error:', error);
    return NextResponse.json({ error: 'Internal system failure' }, { status: 500 });
  }
}