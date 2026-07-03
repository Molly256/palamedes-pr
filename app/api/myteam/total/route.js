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
 * GET: Pulls live downlines and adds up all commission entries into one single big total
 */
export async function GET(request) {
  try {
    const url = new URL(request.url);
    const phone = url.searchParams.get('phone'); 

    if (!phone || !/^07\d{8}$/.test(phone)) { 
      return NextResponse.json({ success: false, error: 'Valid phone parameter is required' }, { status: 400 }); 
    }

    const cleanPhone = String(phone).trim();

    // 1. Fetch downlines hierarchy tree from Redis
    const downlinesData = await redis.hgetall('downlines:' + cleanPhone);
    const downlines = downlinesData && typeof downlinesData === 'object' ? downlinesData : {};
    
    const rawListA = [];
    const rawListB = [];
    const rawListC = [];

    Object.entries(downlines).forEach(function([p, level]) {
      const stringLevel = String(level);
      if (stringLevel === '1') rawListA.push(p); 
      if (stringLevel === '2') rawListB.push(p); 
      if (stringLevel === '3') rawListC.push(p); 
    });

    const cleanListA = rawListA;
    const cleanListB = cleanListA.length === 0 ? [] : rawListB;
    const cleanListC = (cleanListA.length === 0 || cleanListB.length === 0) ? [] : rawListC;

    // 2. Read user transactions exclusively from the master history key path
    const historyKey = `tx:${cleanPhone}:history`;
    const rawHistory = await redis.lrange(historyKey, 0, -1) || [];
    
    // Parse raw strings into clean objects safely
    const history = rawHistory.map(function(item) {
      if (!item) return null;
      try {
        return typeof item === 'string' ? JSON.parse(item) : item;
      } catch {
        return null;
      }
    }).filter(Boolean);

    // 3. REAL-TIME ACCUMULATOR ENGINE: Targets transactions explicitly labeled as "commission"
    const cumulativeCommission = history.reduce(function(sum, tx) {
      const txLabel = String(tx.label || '').toLowerCase().trim();
      const txType = String(tx.type || '').toLowerCase().trim();
      const txNote = String(tx.note || '').toLowerCase().trim();
      
      // Strict matching for any entries labeled or typed as commission across your features
      if (
        txLabel === 'commission' ||
        txLabel.includes('commission') ||
        txType === 'commission' || 
        txType === 'team_commission' ||
        txType === 'team_a_payout' ||
        txType === 'team_b_payout' ||
        txType === 'team_c_payout' ||
        txNote.includes('commission')
      ) {
        // Forces numbers to be positive with Math.abs so they always add upward cleanly
        return sum + Math.abs(toNum(tx.amount, 0));
      }
      return sum;
    }, 0);

    // 4. Return the live data payload to your frontend layout elements
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