export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const toNum = function(v, f) {
  if (f === undefined) f = 0;
  if (v === undefined || v === null) return f;
  const n = Number(v);
  return Number.isNaN(n) ? f : n;
};

// Outputs the full 4-digit year format (e.g., 2026-07-02)
const getUgandanFullDate = function() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
};

/**
 * GET: Fetches actual user live data directly out from Upstash Redis hashes and lists
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get('phone'); 

    if (!phone || !/^07\d{8}$/.test(phone)) { 
      return NextResponse.json({ success: false, error: 'Valid phone parameter is required' }, { status: 400 }); 
    }

    // 1. Parse Upstash Redis hgetall downlines mapping tree
    const downlinesData = await redis.hgetall('downlines:' + phone);
    const downlines = downlinesData && typeof downlinesData === 'object' ? downlinesData : {};
    
    const rawListA = [];
    const rawListB = [];
    const rawListC = [];

    // Map through the hash entries cleanly to populate frontend display rows
    Object.entries(downlines).forEach(function([p, level]) {
      const stringLevel = String(level);
      if (stringLevel === '1') rawListA.push(p); // Direct Team A
      if (stringLevel === '2') rawListB.push(p); // Indirect Team B
      if (stringLevel === '3') rawListC.push(p); // Indirect Team C
    });

    // FIXED: Enforce strict structural integrity check to remove ghost entries
    // If you have no members in Team A, you cannot logically have a Team B or C.
    // If you have no members in Team B, you cannot logically have a Team C.
    const cleanListA = rawListA;
    const cleanListB = cleanListA.length === 0 ? [] : rawListB;
    const cleanListC = (cleanListA.length === 0 || cleanListB.length === 0) ? [] : rawListC;

    // 2. Pull transaction records using the exact matching full year date string pattern
    const fullDateStr = getUgandanFullDate(); // Outputs YYYY-MM-DD
    
    // Fetch from both structural transaction arrays in your app architecture
    const rawHistoryMain = await redis.lrange('user:' + phone + ':tx_history', 0, -1) || [];
    const rawHistoryDaily = await redis.lrange('tx:' + phone + ':' + fullDateStr, 0, -1) || [];
    
    // Combine logs into a unified processing stack
    const combinedRaw = rawHistoryMain.concat(rawHistoryDaily);
    
    const history = combinedRaw.map(function(item) {
      if (!item) return null;
      return typeof item === 'string' ? JSON.parse(item) : item;
    }).filter(Boolean);

    // 3. Calculate pure invitation rewards only (Completely removed system registration rewards)
    const teamCommissionTotal = history.reduce(function(sum, tx) {
      const txNote = String(tx.note || '');
      const txType = String(tx.type || '').toLowerCase().trim();
      
      if (
        txType === 'commission' || 
        txType === 'team_a_payout' ||
        txType === 'team_b_payout' ||
        txType === 'team_c_payout' ||
        txNote.includes('Invitation Rewards')
      ) {
        return sum + toNum(tx.amount, 0);
      }
      return sum;
    }, 0);

    // 4. Return matching payload interface structure for your frontend layout elements
    return NextResponse.json({
      success: true,
      total: teamCommissionTotal, 
      teamCommissionTotal: teamCommissionTotal,        
      breakdown: {
        teamA: cleanListA.length, 
        teamB: cleanListB.length, 
        teamC: cleanListC.length
      },
      listA: cleanListA, 
      listB: cleanListB, 
      listC: cleanListC  
    }, { status: 200 });

  } catch (error) {
    console.error('Fatal API endpoint crash in GET /api/myteam/total:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}