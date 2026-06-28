import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const redis = Redis.fromEnv();

// READ JSON ONCE AT COLD START. VERCEL SAFE
const booksFilePath = path.join(process.cwd(), 'app', 'data', 'books.json');
const ALL_BOOKS = JSON.parse(fs.readFileSync(booksFilePath, 'utf8'));
// Build lookup Map with string keys: "43" -> {id:43, title:...}
const BOOKS_MAP = new Map(ALL_BOOKS.map(b => [String(b.id), b]));

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone'); 
    const date = searchParams.get('date') || getUgandaDateString(); // Africa/Kampala
    
    if (!phone) {
      return NextResponse.json({ error: 'Missing phone' }, { status: 400 });
    }

    // 1. Read book IDs from Redis: books:phone:YYYY-MM-DD
    const redisKey = `books:${phone}:${date}`;
    const bookIds = await redis.smembers(redisKey); // ['45130','45304','1342','43'] strings

    if (!bookIds || bookIds.length === 0) {
      return NextResponse.json([]); 
    }

    // 2. Map IDs -> full book objects. Keeps Redis order. 4 max.
    const booksForToday = bookIds
      .slice(0, 4)
      .map(id => BOOKS_MAP.get(String(id))) // "43" -> full object
      .filter(Boolean); // drop if ID not in books.json

    // 3. Send full book data to page.js for the Books tab
    return NextResponse.json(booksForToday, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('API /books/data Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', detail: error.message }, { status: 500 });
  }
}