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

// Helper function to safely parse the stringified JSON array from Redis
function safeParse(str, fallback = []) {
  try { return JSON.parse(str || '[]') } catch { return fallback }
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

    // Fetch complete user object upfront to analyze fields
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

      // FIXED 1: Parse, modify, and prepare the completedBooks JSON array string
      const currentCompleted = safeParse(userData.completedBooks);
      if (!currentCompleted.includes(String(bookId))) {
        currentCompleted.push(String(bookId));
      }

      // Track how many books have been processed today
      const dailyReadCount = String(Number(userData.books_read_today || 0) + 1);
      const updatedDailyIncome = String(Number(userData.dailyIncome || 0) + payout);

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

      await redis.hsetnx(userKey, 'availableBalance', 0);

      // Atomic execution via pipeline
      const pipe = redis.pipeline();
      
      // Update individual transactional key state
      pipe.hset(bookKey, { status: 'submitted', submittedAt: new Date().toISOString() });
      
      // Increment balances
      pipe.hincrbyfloat(userKey, 'availableBalance', payout);
      
      // FIXED 2: Push stringified updates back into user:phone profile hash boundaries
      pipe.hset(userKey, {
        completedBooks: JSON.stringify(currentCompleted),
        books_read_today: dailyReadCount,
        dailyIncome: updatedDailyIncome
      });

      pipe.lpush(txKey, JSON.stringify(tx)); 
      pipe.lpush(incomeKey, JSON.stringify(tx)); 

      const results = await pipe.exec();

      if (!results || results.length < 5) {
        console.error('Redis pipeline failed to return all operations:', results);
        return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
      }

      // Safe extraction of the new balance from the pipeline return index (index 1 is hincrbyfloat)
      const updatedBalance = results[1];

      return NextResponse.json({
        success: true,
        availableBalance: typeof updatedBalance === 'number' ? updatedBalance : Number(updatedBalance),
        status: 'submitted',
        completedBooks: currentCompleted
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });

  } catch (error) {
    console.error('API /books/submit Error:', error);
    return NextResponse.json({ error: 'Internal system failure' }, { status: 500 });
  }
}