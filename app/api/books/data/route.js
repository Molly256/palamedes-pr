import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Disable Upstash's native request/fetch caching layer completely
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
  cache: 'no-store' 
});

let BOOKS_MAP = null;
async function getBooksMap() {
  if (BOOKS_MAP) return BOOKS_MAP;
  
  // PATH FIXED: Now points correctly to app/data/books.json
  const booksFilePath = path.join(process.cwd(), 'app', 'data', 'books.json');
  const rawData = await fs.readFile(booksFilePath, 'utf8');
  const parsedData = JSON.parse(rawData);
  
  const ALL_BOOKS = Array.isArray(parsedData) ? parsedData : (parsedData.books || []);
  BOOKS_MAP = new Map(ALL_BOOKS.map(b => [String(b.id || b._id), b]));
  return BOOKS_MAP;
}

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const date = searchParams.get('date') || getUgandaDateString();

    if (!phone) return NextResponse.json({ success: false, books: [] }, { status: 400 });

    // 1. Fetch live assigned book IDs from the Redis Set seeded for today
    const bookIds = await redis.smembers(`books:${phone}:${date}`);
    if (!bookIds?.length) {
      return NextResponse.json(
        { success: true, books: [] }, 
        { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
      );
    }

    const BOOKS_MAP = await getBooksMap();
    
    // 2. Fetch individual book hash states matching the seed script design precisely
    const pipeline = redis.pipeline();
    bookIds.forEach(id => {
      const individualBookKey = `book:${phone}:${date}:${String(id).trim()}`;
      pipeline.hgetall(individualBookKey);
    });
    
    const individualBookHashes = await pipeline.exec();

    // 3. Map out and enrich items using real database entries
    const booksForToday = bookIds.map((id, index) => {
      const cleanId = String(id).trim();
      const b = BOOKS_MAP.get(cleanId);
      const hashData = individualBookHashes[index] || {};

      // Derived current live status directly from the individual seed hash strings
      const currentStatus = hashData.status || 'pending';

      return {
        bookId: cleanId,
        title: hashData.title || (b ? b.title : `VIP Premium Book ${cleanId}`),
        cover: hashData.cover || `/books/covers/${cleanId}.jpg`,
        reward: hashData.reward || '0',
        author: b ? b.author : 'Exclusive Author',
        preview: b ? (b.preview || '') : 'Premium content loading...',
        status: currentStatus, 
        readAt: currentStatus === 'read' || currentStatus === 'completed' || currentStatus === 'submitted' ? date : null,
        submittedAt: currentStatus === 'completed' || currentStatus === 'submitted' ? date : null,
      };
    });

    // Enforce strict anti-caching response headers downstream to avoid UI lag
    return NextResponse.json(
      { success: true, books: booksForToday }, 
      {
        headers: { 
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      }
    );

  } catch (error) {
    console.error('API /books/data Error:', error);
    return NextResponse.json({ success: false, books: [] }, { status: 500 });
  }
}