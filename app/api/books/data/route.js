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
  const rawData = await fs.readFile(booksFilePath, 'utf8');
  const parsedData = JSON.parse(rawData);
  // Support both a standard root array or a wrapped { books: [...] } structure
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

    // 1. Fetch the 4 unique book IDs pushed into Redis by your seeder script
    const bookIds = await redis.smembers(`books:${phone}:${date}`);
    if (!bookIds?.length) {
      return NextResponse.json({ success: true, books: [] }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const BOOKS_MAP = await getBooksMap();
    const ids = bookIds.slice(0, 4);

    // 2. Fetch user task tracking sets to match submission states
    const readStateKey = `user:${phone}:read:${date}`;
    const submittedStateKey = `user:${phone}:submitted:${date}`;

    const [readBooks, submittedBooks] = await Promise.all([
      redis.smembers(readStateKey).then(res => res || []),
      redis.smembers(submittedStateKey).then(res => res || [])
    ]);

    // 3. Map out and enrich exactly 4 items to return to your page component
    const booksForToday = ids.map((id) => {
      const cleanId = String(id).trim();
      const b = BOOKS_MAP.get(cleanId);

      // Determine correct status based on your live Redis activity trackers
      let status = 'pending';
      if (submittedBooks.includes(cleanId)) {
        status = 'submitted';
      } else if (readBooks.includes(cleanId)) {
        status = 'read';
      }

      return {
        bookId: cleanId,
        title: b ? b.title : `VIP Premium Book ${cleanId}`,
        author: b ? b.author : 'Exclusive Author',
        preview: b ? (b.preview || '') : 'Premium content loading...',
        status: status,
        readAt: status === 'read' || status === 'submitted' ? date : null,
        submittedAt: status === 'submitted' ? date : null,
      };
    });

    return NextResponse.json({ success: true, books: booksForToday }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (error) {
    console.error('API /books/data Error:', error);
    return NextResponse.json({ success: false, books: [] }, { status: 500 });
  }
}