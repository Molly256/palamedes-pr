import { NextResponse } from 'next/server';
import books from '../../data/books.json'; // app/data/books.json
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function POST(request) {
  try {
    if (!Array.isArray(books) || books.length < 4) {
      return NextResponse.json({ error: 'Not enough books in JSON file' }, { status: 400 });
    }

    const shuffled = [...books].sort(() => 0.5 - Math.random());
    const randomBookIds = shuffled.slice(0, 4).map(book => book.id.toString());
    const today = new Date().toISOString().split('T')[0];

    const userKeys = await redis.keys('user:*');
    const pipeline = redis.pipeline();
    let updatedCount = 0;

    for (const key of userKeys) {
      const user = await redis.hgetall(key);
      if (user?.hasBoughtVip === 'true' || user?.hasBoughtVip === true) {
        const phone = key.split(':')[1];
        if (phone) {
          const targetKey = `books:${phone}:${today}`;
          pipeline.del(targetKey);
          pipeline.sadd(targetKey,...randomBookIds);
          pipeline.expire(targetKey, 172800);
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) await pipeline.exec();

    return NextResponse.json({
      success: true,
      message: `Successfully posted books for ${updatedCount} VIP users.`,
      date: today,
      generatedIds: randomBookIds
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', detail: error.message }, { status: 500 });
  }
}