import fs from 'fs';
import path from 'path';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

function getUgandanDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' });
}

async function seedVipBooks() {
  try {
    console.log('🔄 Starting daily VIP book seeding...');
    const ugDate = getUgandanDateString();
    console.log(`🌍 Current Ugandan Date: ${ugDate}`);

    const booksPath = path.join(process.cwd(), 'app/data/books.json');
    if (!fs.existsSync(booksPath)) {
      throw new Error(`books.json not found at: ${booksPath}`);
    }
    const booksData = JSON.parse(fs.readFileSync(booksPath, 'utf-8'));
    const books = Array.isArray(booksData) ? booksData : booksData.books;
    
    if (!books || books.length < 4) {
      throw new Error('Minimum 4 books required in books.json.');
    }

    // SAFE SHUFFLE (Fisher-Yates) - Guarantees 4 completely distinct books
    const shuffled = [...books];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Pick the first 4 uniquely shuffled elements
    const randomBookIds = shuffled
      .slice(0, 4)
      .map(book => String(book.id || book._id || '').trim())
      .filter(id => id.length > 0);

    console.log(`📚 Selected 4 Unique Book IDs: ${randomBookIds.join(', ')}`);

    const userKeys = await redis.keys('user:*');
    if (userKeys.length === 0) {
      console.log('⚠️ No users found in Redis database.');
      return;
    }

    let seededCount = 0;

    for (const key of userKeys) {
      const userData = await redis.hgetall(key);
      
      if (userData && (userData.hasBoughtVip === true || userData.hasBoughtVip === 'true')) {
        const phone = userData.phone || userData.phoneNumber || userData.phone_number;
        
        if (!phone) continue;

        const redisKey = `books:${phone}:${ugDate}`;

        await redis.del(redisKey);
        await redis.sadd(redisKey, ...randomBookIds); // Adds 4 separate items into the set
        await redis.expire(redisKey, 60 * 60 * 24 * 7); 

        seededCount++;
      }
    }

    console.log(`✅ Success! Seeded exactly 4 books for ${seededCount} VIP users.`);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
  }
}

seedVipBooks();