import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { redis } from '@/lib/redis'; // Adjust this to your actual Upstash client import

export async function POST(request) {
  try {
    // 1. Read and parse books from public/data/books.json
    const jsonPath = path.join(process.cwd(), 'public', 'data', 'books.json');
    const fileData = fs.readFileSync(jsonPath, 'utf8');
    const books = JSON.parse(fileData);

    if (!Array.isArray(books) || books.length < 4) {
      return NextResponse.json({ error: 'Not enough books in JSON file' }, { status: 400 });
    }

    // 2. Select 4 unique random book IDs
    const shuffled = [...books].sort(() => 0.5 - Math.random());
    const randomBookIds = shuffled.slice(0, 4).map(book => book.id.toString());

    // 3. Generate today's date formatted as yyyy-mm-dd (Matches your screenshot: 2026-06-28)
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    // 4. Find all user profile keys matching your structure
    const userKeys = await redis.keys('user:*');
    
    // 5. Initialize Upstash pipeline for batch processing
    const pipeline = redis.pipeline();
    let updatedCount = 0;

    for (const key of userKeys) {
      // Fetch the user object from Upstash Hash
      const user = await redis.hgetall(key);

      // Check VIP status (supports both string and boolean types)
      if (user && (user.hasBoughtVip === 'true' || user.hasBoughtVip === true)) {
        
        // Extract phone directly from the key name (e.g., "user:0753520252" -> "0753520252")
        const phone = key.split(':')[1]; 
        
        if (phone) {
          const targetKey = `books:${phone}:${dateStr}`;
          
          // Delete any existing key for today to start fresh
          pipeline.del(targetKey);
          
          // Add the 4 IDs to a Redis Set matching your screenshot format
          pipeline.sadd(targetKey, ...randomBookIds);
          
          // Optional: Automatically clean up after 48 hours to save Upstash space
          pipeline.expire(targetKey, 172800); 

          updatedCount++;
        }
      }
    }

    // 6. Execute all commands in one single round-trip
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
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}