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

    // Check spins first - can't pipeline this one
    const currentSpins = parseInt(await redis.hget(userKey, 'spins') || '0', 10);

    if (currentSpins < 1) {
      return NextResponse.json(
        { success: false, error: "You do not have any lucky spins remaining!" },
        { status: 400 }
      );
    }

    const prizeAmount = 2000;
    const timestamp = Date.now();

    const txData = {
      id: `tx_${timestamp}_wheel`,
      type: 'system_increase',
      label: 'Lucky Wheel Win',
      amount: prizeAmount.toString(),
      timestamp: timestamp,
      status: 'completed'
    };

    // Single pipeline for all writes + reads
    const pipeline = redis.pipeline();
    pipeline.hincrby(userKey, 'spins', -1);
    pipeline.hincrby(userKey, 'availableBalance', prizeAmount);
    pipeline.lpush(txKey, JSON.stringify(txData));
    pipeline.hget(userKey, 'spins'); // index 3
    pipeline.hget(userKey, 'availableBalance'); // index 4

    const results = await pipeline.exec();

    return NextResponse.json({
      success: true,
      winningSliceIndex: 0,
      prizeAmount: prizeAmount,
      remainingSpins: Number(results[3].result || 0),
      newBalance: Number(results[4].result || 0)
    });

  } catch (error) {
    console.error("Database Engine Spin Transaction Failure:", error);
    return NextResponse.json(
      { success: false, error: "Internal Server Processing Error." },
      { status: 500 }
    );
  }
}