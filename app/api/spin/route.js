import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Missing phone." },
        { status: 400 }
      );
    }

    const userKey = `user:${phone}`;
    const txKey = `tx:${phone}:history`; // TX history key

    // 1. Fetch the spin count from Redis hash
    const currentSpinsStr = await redis.hget(userKey, 'spins');
    const currentSpins = parseInt(currentSpinsStr || '0', 10);

    // 2. Prevent execution if user has 0 spins
    if (currentSpins < 1) {
      return NextResponse.json(
        { success: false, error: "You do not have any lucky spins remaining!" },
        { status: 400 }
      );
    }

    const prizeAmount = 2000;
    const timestamp = Date.now();

    // 3. Atomic transaction: deduct 1 spin, add to available_balance, create TX
    const pipeline = redis.pipeline();
    pipeline.hincrby(userKey, 'spins', -1);
    pipeline.hincrby(userKey, 'available_balance', prizeAmount);
    
    // ADDED: Create transaction log for All tab
    pipeline.lpush(txKey, JSON.stringify({
      type: 'lucky wheel',
      amount: prizeAmount,
      timestamp: timestamp,
      description: 'Lucky Wheel Win'
    }));
    
    await pipeline.exec();

    // 4. Get updated spins and balance to sync UI
    const [finalSpins, newBalance] = await Promise.all([
      redis.hget(userKey, 'spins'),
      redis.hget(userKey, 'available_balance')
    ]);

    return NextResponse.json({
      success: true,
      winningSliceIndex: 0,
      prizeAmount: prizeAmount,
      remainingSpins: Number(finalSpins || 0),
      newBalance: Number(newBalance || 0) // Send back for UI update
    });

  } catch (error) {
    console.error("Database Engine Spin Transaction Failure:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Processing Error." },
      { status: 500 }
    );
  }
}