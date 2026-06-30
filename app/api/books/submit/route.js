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

// FIXED: Upgraded parser enforces array validation to neutralize type crashes
function safeParse(str, fallback = []) {
  if (!str) return fallback;
  try { 
    const parsed = JSON.parse(str);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch { 
    return fallback; 
  }
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

      // Safe extraction ensures this is always an array
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

      // Calculate new math states inside node memory space safely
      const updatedBalance = Number(userData.availableBalance || 0) + payout;
      const nextDailyCount = Number(userData.books_read_today || 0) + 1;
      const nextDailyIncome = Number(userData.dailyIncome || 0) + payout;

      // 1. Mark the individual book identifier state as submitted
      await redis.hset(bookKey, { status: 'submitted', submittedAt: new Date().toISOString() });

      // 2. Overwrite target field strings onto user mapping hash profiles
      await redis.hset(userKey, {
        availableBalance: String(updatedBalance),
        books_read_today: String(nextDailyCount),
        dailyIncome: String(nextDailyIncome),
        completedBooks: JSON.stringify(currentCompleted)
      });

      // 3. Document logs to ledger histories
      await redis.lpush(txKey, JSON.stringify(tx)); 
      await redis.lpush(incomeKey, JSON.stringify(tx)); 

      return NextResponse.json({
        success: true,
        availableBalance: updatedBalance,
        status: 'submitted',
        books_read_today: nextDailyCount,
        completedBooks: currentCompleted
      });
    }

    return NextResponse.json({ error: 'Invalid action specified' }, { status: 400 });

  } catch (error) {
    console.error('API /books/submit Error:', error);
    return NextResponse.json({ error: 'Internal system failure' }, { status: 500 });
  }
}