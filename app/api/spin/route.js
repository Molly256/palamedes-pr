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
    const txKey = `tx:${phone}:history`;

    const currentSpinsStr = await redis.hget(userKey, 'spins');
    const currentSpins = parseInt(currentSpinsStr || '0', 10);

    if (currentSpins < 1) {
      return NextResponse.json(
        { success: false, error: "You do not have any lucky spins remaining!" },
        { status: 400 }
      );
    }

    const prizeAmount = 2000;
    const timestamp = Date.now();

    const pipeline = redis.pipeline();
    pipeline.hincrby(userKey, 'spins', -1);
    pipeline.hincrby(userKey, 'availableBalance', prizeAmount); // FIXED: camelCase
    
    pipeline.lpush(txKey, JSON.stringify({
      type: 'lucky wheel',
      amount: prizeAmount,
      timestamp: timestamp,
      description: 'Lucky Wheel Win'
    }));
    
    await pipeline.exec();

    const [finalSpins, newBalance] = await Promise.all([
      redis.hget(userKey, 'spins'),
      redis.hget(userKey, 'availableBalance') // FIXED: camelCase
    ]);

    return NextResponse.json({
      success: true,
      winningSliceIndex: 0,
      prizeAmount: prizeAmount,
      remainingSpins: Number(finalSpins || 0),
      newBalance: Number(newBalance || 0)
    });

  } catch (error) {
    console.error("Database Engine Spin Transaction Failure:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Processing Error." },
      { status: 500 }
    );
  }
}