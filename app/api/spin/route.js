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

    // 3. Atomic transaction: deduct 1 spin, add 2,000 to available_balance
    const pipeline = redis.pipeline();
    pipeline.hincrby(userKey, 'spins', -1);
    pipeline.hincrby(userKey, 'available_balance', 2000);
    await pipeline.exec();

    // 4. Get updated spins to sync UI
    const finalSpins = await redis.hget(userKey, 'spins');

    return NextResponse.json({
      success: true,
      winningSliceIndex: 0,
      prizeAmount: 2000,
      remainingSpins: Number(finalSpins || 0)
    });

  } catch (error) {
    console.error("Database Engine Spin Transaction Failure:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Processing Error." },
      { status: 500 }
    );
  }
}