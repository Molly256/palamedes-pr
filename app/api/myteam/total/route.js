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

// FIXED: Outputs the full 4-digit year format (e.g., 2026-07-02) to match your VIP levels file exactly
const getUgandanFullDate = () => {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
};

/**
 * GET: Fetches actual user live data directly out from Upstash Redis hashes and lists
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone'); 

    if (!phone || !/^07\d{8}$/.test(phone)) { 
      return NextResponse.json({ success: false, error: 'Valid phone parameter is required' }, { status: 400 }); 
    }

    // 1. Parse Upstash Redis hgetall downlines mapping tree
    const downlinesData = await redis.hgetall(`downlines:${phone}`);
    const downlines = downlinesData && typeof downlinesData === 'object' ? downlinesData : {};
    
    const listA = [];
    const listB = [];
    const listC = [];

    // Map through the hash entries cleanly to populate frontend display rows
    Object.entries(downlines).forEach(([p, level]) => {
      const stringLevel = String(level);
      if (stringLevel === '1') listA.push(p); // Direct Team A
      if (stringLevel === '2') listB.push(p); // Indirect Team B
      if (stringLevel === '3') listC.push(p); // Indirect Team C
    });

    // 2. FIXED: Pull transaction records using the exact matching full year date string pattern
    const fullDateStr = getUgandanFullDate(); // Outputs YYYY-MM-DD
    
    // Fetch from both structural transaction arrays in your app architecture
    const rawHistoryMain = await redis.lrange(`user:${phone}:tx_history`, 0, -1) || [];
    const rawHistoryDaily = await redis.lrange(`tx:${phone}:${fullDateStr}`, 0, -1) || [];
    
    // Combine logs into a unified processing stack
    const combinedRaw = [...rawHistoryMain, ...rawHistoryDaily];
    
    const history = combinedRaw.map(item => {
      if (!item) return null;
      return typeof item === 'string' ? JSON.parse(item) : item;
    }).filter(Boolean);

    // 3. FIXED: Compute aggregate cash total using your new header note criteria
    const total = history.reduce((sum, tx) => {
      const txNote = String(tx.note || '');
      if (
        tx.type === 'commission' || 
        txNote.includes('Invitation Rewards') || // <- MATCHES YOUR NEW TEXT LABEL
        (tx.type === 'system_increase' && txNote === 'Registration Reward')
      ) {
        return sum + toNum(tx.amount, 0);
      }
      return sum;
    }, 0);

    // 4. Return matching payload interface structure for your frontend layout elements
    return NextResponse.json({
      success: true,
      total, 
      breakdown: {
        teamA: listA.length, 
        teamB: listB.length, 
        teamC: listC.length,
      },
      listA, 
      listB, 
      listC  
    }, { status: 200 });

  } catch (error) {
    console.error('Fatal API endpoint crash in GET /api/myteam/total:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}