import { NextResponse } from 'next/server';
import { redis } from '@/lib/redis'; // Shared database driver instance

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

    // 1. Fetch all tracking counters out of the user's data hash in a single round-trip
    const [totalRewards, teamA, teamB, teamC] = await Promise.all([
      redis.hget(`user:${phone}`, 'team_total_rewards'),
      redis.hget(`user:${phone}`, 'team_a_count'),
      redis.hget(`user:${phone}`, 'team_b_count'),
      redis.hget(`user:${phone}`, 'team_c_count')
    ]);

    // 2. Format response payload to match frontend structural expectations
    return NextResponse.json({ 
      success: true,
      total: Number(totalRewards || 0),
      breakdown: {
        teamA: Number(teamA || 0),
        teamB: Number(teamB || 0),
        teamC: Number(teamC || 0)
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