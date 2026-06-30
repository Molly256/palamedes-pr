import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';
import { VIPS } from './app/config/vips.js';

const redis = Redis.fromEnv();

// Matches your API: Shuffles and updates by reference arrays
function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Matches your API: Direct timezone generation
function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
}

// Matches your API: Helper to parse JSON safely
function safeParse(str, fallback = []) {
  try { return JSON.parse(str || '[]') } catch { return fallback }
}

// Matches your API: Core function to assign books and stage pipelines
async function assignBooksToUser(phone, vipLevel, today, pipeline) {
  const selectedVip = VIPS[vipLevel];
  const booksPath = path.join(process.cwd(), 'app/data/books.json');
  const coversDir = path.join(process.cwd(), 'public/books/covers');

  const allBooks = JSON.parse(fs.readFileSync(booksPath, 'utf8'));
  const coverFiles = fs.readdirSync(coversDir);

  const coverIds = new Set(
    coverFiles.map(f => f.replace(/\.jpg$/i, '')).filter(id => /^\d+$/.test(id))
  );

  const validBooks = allBooks.filter(b => coverIds.has(String(b.id)));
  if (validBooks.length === 0) throw new Error('No books with covers found');

  const shuffled = shuffle(validBooks);
  const booksToAssign = shuffled.slice(0, Math.min(selectedVip.books, validBooks.length));
  const unlockedBooks = booksToAssign.map(b => String(b.id));
  const assignedBooksMeta = booksToAssign.map(b => ({
    id: String(b.id), title: b.title, cover: `/books/covers/${b.id}.jpg`, reward: selectedVip.perBook
  }));

  booksToAssign.forEach(b => {
    const bookId = String(b.id);
    const bookKey = `book:${phone}:${today}:${bookId}`;
    pipeline.hset(bookKey, {
      phone, bookId, vipLevel: String(vipLevel), reward: selectedVip.perBook,
      title: b.title, cover: `/books/covers/${bookId}.jpg`, status: 'pending',
      date: today, createdAt: String(Date.now())
    });
    pipeline.sadd(`books:${phone}:${today}`, bookId);
  });

  return { unlockedBooks, assignedBooksMeta };
}

async function seedVipBooks() {
  try {
    console.log('🔄 Starting VIP book seeding matching API logic...');
    const today = getUgandaDateString();
    console.log(`🌍 Current Ugandan Date: ${today}`);

    // Fetch all keys matching the user profile pattern
    const userKeys = await redis.keys('user:*');
    if (userKeys.length === 0) {
      console.log('⚠️ No users found in Redis database.');
      return;
    }

    let seededCount = 0;
    let skippedCount = 0;

    for (const key of userKeys) {
      if (!key.startsWith('user:')) continue;

      const user = await redis.hgetall(key);
      
      // Matches your API check: Requires an explicit phone property inside the hash
      if (!user || !user.phone) {
        skippedCount++;
        continue;
      }

      // Format Enforcement: Ensure we use the exact phone property string (e.g., 07XXXXXXXX)
      const phone = String(user.phone).trim();

      // Check if user bought VIP using the exact true flags checked in the API
      const hasBoughtVip = user.hasBoughtVip === 'true' || user.hasBoughtVip === true;
      const currentVip = Number(user.vip || 0);

      if (hasBoughtVip && currentVip > 0) {
        const selectedVip = VIPS[currentVip];
        if (!selectedVip) {
          console.log(`⚠️ User ${phone} has an invalid VIP level: ${currentVip}. Skipping.`);
          continue;
        }

        const pipeline = redis.pipeline();

        // Clear previous tracking sets for the day to avoid mixing duplicates
        pipeline.del(`books:${phone}:${today}`);

        // Run the cloned assignment logic 
        const { unlockedBooks } = await assignBooksToUser(phone, currentVip, today, pipeline);

        // Update profile block matches POST api logic exactly
        pipeline.hset(key, {
          unlockedBooks: JSON.stringify(unlockedBooks),
          completedBooks: '[]',
          books_read_today: '0',
          dailyIncome: '0',
          lastResetDate: today,
          vip_bought_date: today
        });

        // Execute transactions
        await pipeline.exec();
        seededCount++;
        console.log(`✅ Seeded ${unlockedBooks.length} books for User: ${phone} (VIP ${currentVip})`);
      } else {
        skippedCount++;
      }
    }

    console.log(`\n📊 --- Seeding Report ---`);
    console.log(`✅ Successfully seeded: ${seededCount} VIP users.`);
    console.log(`Skip/Non-VIP accounts: ${skippedCount}`);
  } catch (error) {
    console.error('❌ Seeding process failed:', error.message);
  }
}

seedVipBooks();