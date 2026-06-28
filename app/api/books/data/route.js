import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const redis = Redis.fromEnv();

// READ JSON ONCE AT COLD START. WORKS ON VERCEL
const booksFilePath = path.join(process.cwd(), 'app', 'data', 'books.json');
const ALL_BOOKS = JSON.parse(fs.readFileSync(booksFilePath, 'utf8'));

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone'); // app must send ?phone=...
    const date = searchParams.get('date') || getUgandaDateString(); // Uganda time
    
    if (!phone) {
      return NextResponse.json({ error: 'Missing phone' }, { status: 400 });
    }

    // 1. Read book IDs from Redis: books:phone:yy-mm-dd
    const redisKey = `books:${phone}:${date}`;
    const bookIds = await redis.smembers(redisKey); // ['45130','45304','1342','43']

    if (!bookIds || bookIds.length === 0) {
      return NextResponse.json([]); // No books for today
    }

    // 2. Go to app/data/books.json and get data for each ID
    const booksForToday = ALL_BOOKS.filter(book =>
      bookIds.includes(book.id.toString())
    );

    // 3. Send full book data to page.js for the Books tab
    return NextResponse.json(booksForToday, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('API /books/data Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', detail: error.message }, { status: 500 });
  }
}