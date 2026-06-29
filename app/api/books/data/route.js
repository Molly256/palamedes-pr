import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const redis = Redis.fromEnv();

let BOOKS_MAP = null;
async function getBooksMap() {
  if (BOOKS_MAP) return BOOKS_MAP;
  const booksFilePath = path.join(process.cwd(), 'app', 'data', 'books.json');
  const ALL_BOOKS = JSON.parse(await fs.readFile(booksFilePath, 'utf8'));
  BOOKS_MAP = new Map(ALL_BOOKS.map(b => [String(b.id), b]));
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
    
    if (!phone) {
      return NextResponse.json({ success: false, books: [] }, { status: 400 });
    }

    const bookIds = await redis.smembers(`books:${phone}:${date}`);
    if (!bookIds?.length) {
      return NextResponse.json({ success: true, books: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const BOOKS_MAP = await getBooksMap();
    const booksForToday = bookIds
      .slice(0, 4)
      .map(id => {
        const b = BOOKS_MAP.get(String(id));
        if (!b) return null;
        return {
          bookId: String(id),
          title: b.title,
          author: b.author,
          preview: b.preview || ''     // <- FIXED: books.json uses "preview"
        };
      })
      .filter(Boolean);

    return NextResponse.json({ success: true, books: booksForToday }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('API /books/data Error:', error);
    return NextResponse.json({ success: false, books: [] }, { status: 500 });
  }
}