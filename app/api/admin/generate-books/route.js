import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export async function POST(request) {
  try {
    // FIX: Vercel-safe path. process.cwd() = project root
    const jsonPath = path.join(process.cwd(), 'public/data/books.json');
    const fileData = fs.readFileSync(jsonPath, 'utf8');
    const books = JSON.parse(fileData);

    if (!Array.isArray(books) || books.length < 4) {
      return NextResponse.json({ error: 'Not enough books in JSON file' }, { status: 400 });
    }

    // 2. Select 4 unique random book IDs
    const shuffled = [...books].sort(() => 0.5 - Math.random());
    const randomBookIds = shuffled.slice(0, 4).map(book => book.id.toString());

    // 3. Generate today's date yyyy-mm-dd 
    const today = new Date().toISOString().split('T')[0];

    // 4. Find all user profile keys
    const userKeys = await redis.keys('user:*');
    
    const pipeline = redis.pipeline();
    let updatedCount = 0;

    for (const key of userKeys) {
      const user = await redis.hgetall(key);
      if (user && (user.hasBoughtVip === 'true' || user.hasBoughtVip === true)) {
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

    if (updatedCount > 0) {
      await pipeline.exec();
    }

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