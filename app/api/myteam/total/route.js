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

    const cleanPhone = String(phone).trim();

    // 1. Parse Upstash Redis hgetall downlines mapping tree
    const downlinesData = await redis.hgetall('downlines:' + cleanPhone);
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

    const cleanListA = rawListA;
    const cleanListB = cleanListA.length === 0 ? [] : rawListB;
    const cleanListC = (cleanListA.length === 0 || cleanListB.length === 0) ? [] : rawListC;

    // 2. FIXED: Scan for EVERY date list matching your pattern "tx:phone:2026-mm-dd"
    let allRecords = [];

    // A. Grab the primary persistent transaction file array if it exists
    const rawHistoryMain = await redis.lrange('user:' + cleanPhone + ':tx_history', 0, -1) || [];
    allRecords = allRecords.concat(rawHistoryMain);

    // B. Find all historical date lists across your entire system timeline
    const userKeysPattern = `tx:${cleanPhone}:*`;
    const historicalDateLists = await redis.keys(userKeysPattern) || [];

    // Loop through every single day folder list found in memory
    for (const listKey of historicalDateLists) {
      const recordsForDay = await redis.lrange(listKey, 0, -1) || [];
      allRecords = allRecords.concat(recordsForDay);
    }
    
    // Process and parse all raw transaction JSON strings safely into standard objects
    const history = allRecords.map(function(item) {
      if (!item) return null;
      return typeof item === 'string' ? JSON.parse(item) : item;
    }).filter(Boolean);

    // 3. FIXED: Loops through all dates and compiles old plus new payouts into one massive total
    const cumulativeCommission = history.reduce(function(sum, tx) {
      const txNote = String(tx.note || '');
      const txType = String(tx.type || '').toLowerCase().trim();
      
      if (
        txType === 'commission' || 
        txType === 'team_a_payout' ||
        txType === 'team_b_payout' ||
        txType === 'team_c_payout' ||
        txNote.includes('Invitation Rewards') ||
        txNote.toLowerCase().includes('commission')
      ) {
        return sum + toNum(tx.amount, 0);
      }
      return sum;
    }, 0);

    // 4. Return matching payload interface structure for your frontend layout elements
    return NextResponse.json({
      success: true,
      total: cumulativeCommission, 
      teamCommissionTotal: cumulativeCommission,        
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