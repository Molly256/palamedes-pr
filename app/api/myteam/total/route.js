export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv(); // <- same as auth route

const toNum = (v, f = 0) => {
  if (v === undefined || v === null) return f
  const n = Number(v)
  return Number.isNaN(n) ? f : n
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number parameter is required' }, 
        { status: 400 }
      );
    }

    const userKey = `user:${phone}`;

    // 1. Fetch all tracking counters out of the user's data hash in a single round-trip
    const [totalRewards, teamA, teamB, teamC] = await Promise.all([
      redis.hget(userKey, 'team_total_rewards'),
      redis.hget(userKey, 'team_a_count'),
      redis.hget(userKey, 'team_b_count'),
      redis.hget(userKey, 'team_c_count')
    ]);

    // 2. Format response payload to match frontend structural expectations
    return NextResponse.json({ 
      success: true,
      total: toNum(totalRewards),
      breakdown: {
        teamA: toNum(teamA),
        teamB: toNum(teamB),
        teamC: toNum(teamC)
      }
    }, { status: 200 });

  } catch (error) {
    console.error('Fatal API endpoint crash in /myteam/total:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error processing team metrics' }, 
      { status: 500 }
    );
  }
}