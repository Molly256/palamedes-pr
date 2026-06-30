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
    const phone = searchParams.get('phone'); // <- CHANGED: was userId

    if (!phone) { // <- CHANGED
      return NextResponse.json({ success: false, error: 'Phone parameter is required' }, { status: 400 }); // <- CHANGED
    }

    const userKey = `user:${phone}`; // <- CHANGED

    // 1. INSERTED: Get A/B/C phone numbers from downlines hash
    const downlines = await redis.hgetall(`downlines:${phone}`) || {}; // <- CHANGED
    
    const listA = [];
    const listB = [];
    const listC = [];
    Object.entries(downlines).forEach(([p, level]) => {
      if (level === '1') listA.push(p); // Direct
      if (level === '2') listB.push(p); // A invited
      if (level === '3') listC.push(p); // B invited
    });

    // 2. INSERTED: Sum REAL commission from Transaction History tab
    const rawHistory = await redis.lrange(`user:${phone}:tx_history`, 0, -1); // <- CHANGED
    const history = (rawHistory || []).map(item => (typeof item === 'string' ? JSON.parse(item) : item));

    const total = history.reduce((sum, tx) => {
      // Count only commission + registration reward from Invitation Reward tab
      if (tx.type === 'commission' || (tx.type === 'system_increase' && tx.note === 'Registration Reward')) {
        return sum + toNum(tx.amount, 0);
      }
      return sum;
    }, 0);

    return NextResponse.json({
      success: true,
      total, // <- Real sum from tx history for the big box
      breakdown: {
        teamA: listA.length, 
        teamB: listB.length, 
        teamC: listC.length,
      },
      listA, // <- Phones for A row
      listB, // <- Phones for B row 
      listC  // <- Phones for C row
    }, { status: 200 });

  } catch (error) {
    console.error('Fatal API endpoint crash in GET /api/myteam/total:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}