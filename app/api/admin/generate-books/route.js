import { NextResponse } from 'next/server';
import books from '../../../public/data/books.json'; // <-- FIXED: Direct import
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function POST(request) {
  try {
    // 1. books is already parsed, no fs needed
    if (!Array.isArray(books) || books.length < 4) {
      return NextResponse.json({ error: 'Not enough books in JSON file' }, { status: 400 });
    }

    // 2. Select 4 unique random book IDs
    const shuffled = [...books].sort(() => 0.5 - Math.random());
    const randomBookIds = shuffled.slice(0, 4).map(book => book.id.toString());

    // 3. Generate today's date yyyy-mm-dd 
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // 4. Find all user profile keys
    const userKeys = await redis.keys('user:*');
    
    const pipeline = redis.pipeline();
    let updatedCount = 0;

    for (const key of userKeys) {
      const user = await redis.hgetall(key);
      if (user && (user.hasBoughtVip === 'true' || user.hasBoughtVip === true)) {
        const phone = key.split(':')[1]; 
        if (phone) {
          const targetKey = `books:${phone}:${dateStr}`;
          pipeline.del(targetKey);
          pipeline.sadd(targetKey, ...randomBookIds);
          pipeline.expire(targetKey, 172800); 
          updatedCount++;
        }
      }
    }

    if (updatedCount > 0) {
      await pipeline.exec();
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully posted books for ${updatedCount} VIP users.`,
      date: dateStr,
      generatedIds: randomBookIds
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', detail: error.message }, { status: 500 });
  }
}