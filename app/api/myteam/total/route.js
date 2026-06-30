import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis'; // Replace with your actual redis package if different

// Initialize Redis Client (Adjust environment variables as needed for your setup)
const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});

/**
 * GET Handler for /api/myteam/total?phone=...
 * Resolves the 405 Method Not Allowed browser routing error.
 */
export async function GET(request) {
  try {
    // 1. Extract and validate phone number query parameters
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Phone number parameter is required' }, 
        { status: 400 }
      );
    }

    // 2. Fetch the pre-aggregated team reward metric from the user's data hash
    const teamTotalRewards = await redis.hget(`user:${phone}`, 'team_total_rewards') || '0';

    // 3. Return payload back to dashboard frontend components
    return NextResponse.json({ 
      success: true,
      total: Number(teamTotalRewards) 
    }, { status: 200 });

  } catch (error) {
    console.error('Fatal API endpoint crash in /myteam/total:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error processing team metrics' }, 
      { status: 500 }
    );
  }
}

/**
 * Transaction script processor to calculate commission allocations
 */
export async function payInvitationReward(downlinePhone, vipLevelBought) {
  try {
    const inviterPhone = await redis.hget(`user:${downlinePhone}`, 'invited_by');
    if (!inviterPhone) return;

    // 1. Enforce active VIP requirements
    const inviterVip = Number(await redis.hget(`user:${inviterPhone}`, 'vip') || 0);
    if (inviterVip === 0) return; 

    // Pool configuration matrix matching system tier definitions
    const vipAmounts = { 
      1: 80000, 2: 250000, 3: 790000, 4: 1000000, 5: 1500000, 
      6: 2100000, 7: 4000000, 8: 4600000, 9: 5000000, 10: 8000000 
    };

    // 2. Enforce VIP caps matching system logic
    const effectiveVipTier = Math.min(inviterVip, vipLevelBought);
    const targetRewardAmount = vipAmounts[effectiveVipTier];
    if (!targetRewardAmount) return;

    const level = Number(await redis.hget(`downlines:${inviterPhone}`, downlinePhone));
    if (!level || level > 3) return;

    const rate = level === 1 ? 0.05 : level === 2 ? 0.02 : 0.01;
    const rewardAmount = Math.floor(targetRewardAmount * rate);
    if (rewardAmount <= 0) return;

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });

    // 3. Append detailed action data payload directly to dated chronological ledger
    await redis.lpush(`tx:${inviterPhone}:${today}`, JSON.stringify({
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`, 
      type: 'invitation_reward', 
      amount: String(rewardAmount),
      from: downlinePhone, 
      level, 
      vipLevel: String(vipLevelBought),
      date: today, 
      status: 'completed',
      createdAt: String(Date.now())
    }));

    // 4. Atomically persist balance increases alongside dedicated frontend counting field
    const inviterKey = `user:${inviterPhone}`;
    
    // We use a pipeline operation to update both properties reliably in parallel
    await redis.pipeline()
      .hincrbyfloat(inviterKey, 'availableBalance', rewardAmount)
      .hincrbyfloat(inviterKey, 'team_total_rewards', rewardAmount)
      .exec();

  } catch (err) { 
    console.error('Invitation reward transaction system logic failure:', err); 
  }
}