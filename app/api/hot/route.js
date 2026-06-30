import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = Redis.fromEnv();
const toNum = (v, f = 0) => { const n = Number(v); return Number.isNaN(n) ? f : n; };

// Single point of truth for date generation
const getTodayDateStr = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Kampala" }));
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

// Helper function to extract and parse pure item records out of the Redis List
const parseAndCategorizeList = (historyArray) => {
  const history = [];
  const ongoing = [];
  const expired = [];

  if (!Array.isArray(historyArray)) return { history, ongoing, expired };

  historyArray.forEach(item => {
    let parsed = item;
    if (typeof item === 'string') {
      try {
        parsed = JSON.parse(item);
      } catch {
        return; // Ignore malformed data
      }
    }

    if (!parsed || !parsed.type) return;

    // Push into global chronological history timeline
    history.push(parsed);

    // Dynamic categorization based on action type state flags
    if (parsed.type === 'buy_hot' && parsed.payload) {
      ongoing.push(parsed.payload);
    } else if (parsed.type === 'collect_hot' && parsed.payload) {
      expired.push(parsed.payload);
    }
  });

  return { history, ongoing, expired };
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    if (!phone) return NextResponse.json({ success: false, error: "Missing phone" }, { status: 400 });

    const dateStr = getTodayDateStr();
    const rootUserKey = `user:${phone}`;
    const listKey = `tx:${phone}:${dateStr}`; 

    console.log('[HOT GET] Profile:', rootUserKey, 'List:', listKey);

    // We only need to fetch the User profile and the single List key now
    const [userProfile, rawHistory] = await Promise.all([
      redis.hgetall(rootUserKey),
      redis.lrange(listKey, 0, -1)
    ]);
    
    if (!userProfile || Object.keys(userProfile).length === 0) {
      return NextResponse.json({ success: true, wallet: 0, ongoing: [], expired: [], history: [] });
    }

    const wallet = toNum(userProfile.availableBalance);
    
    // Process everything dynamically out of the clean List keys
    const { history, ongoing, expired } = parseAndCategorizeList(rawHistory);

    return NextResponse.json({ success: true, wallet, ongoing, expired, history });
  } catch (err) {
    console.error('[HOT GET] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json().catch(() => null);
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    const { phone, action, payload } = body;
    if (!phone) return NextResponse.json({ success: false, error: "Missing phone" }, { status: 400 });

    const dateStr = getTodayDateStr();
    const rootUserKey = `user:${phone}`;
    const listKey = `tx:${phone}:${dateStr}`; 
    
    console.log('[HOT POST] Action:', action, 'Profile:', rootUserKey, 'List:', listKey);

    // Fetch the single List key to compute calculations on active datasets
    const [userProfile, rawHistory] = await Promise.all([
      redis.hgetall(rootUserKey),
      redis.lrange(listKey, 0, -1)
    ]);

    if (!userProfile || Object.keys(userProfile).length === 0) {
      return NextResponse.json({ success: false, error: "User account not found" }, { status: 404 });
    }
    
    let wallet = toNum(userProfile.availableBalance);
    const { ongoing } = parseAndCategorizeList(rawHistory);

    const uuid = (typeof crypto.randomUUID === 'function') 
      ? crypto.randomUUID() 
      : `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const timestampStr = new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).replace(',', '').slice(0,16);

    if (action === 'BUY_HOT') {
      const price = toNum(payload?.price);
      if (wallet < price) return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 });

      wallet = wallet - price;
      
      // Store the dynamic meta transaction info directly inside the single list log
      const txItem = { 
        id: uuid,
        type: 'buy_hot',
        amount: String(-price),
        note: `Bought share ${payload?.newHotInstance?.title || 'Item'}`,
        status: 'completed',
        createdAt: timestampStr,
        payload: payload?.newHotInstance // Kept inside list log natively
      };

      await Promise.all([
        redis.hset(rootUserKey, { availableBalance: String(wallet) }),
        redis.lpush(listKey, JSON.stringify(txItem)) 
      ]);

      const freshHistory = await redis.lrange(listKey, 0, -1);
      const parsedData = parseAndCategorizeList(freshHistory);
      
      return NextResponse.json({ success: true, wallet, history: parsedData.history });
    }

    if (action === 'COLLECT_HOT') {
      const hotIdToFind = payload?.hotId;
      const hot = ongoing.find(i => i && i.hotId === hotIdToFind);
      if (!hot) return NextResponse.json({ success: false, error: "Hot instance not found or already collected" }, { status: 404 });

      const payout = toNum(hot.expectedReturn);
      wallet = wallet + payout;

      const txItem = { 
        id: uuid,
        type: 'collect_hot',
        amount: String(payout),
        note: `Collected share ${hot.title || 'Item'}`,
        status: 'completed',
        createdAt: timestampStr,
        payload: hot // Saved into list dataset history context
      };

      // We need to mark the old matching item as redeemed so it doesn't get processed twice
      const updatedHistoryArray = rawHistory.map(item => {
        let parsed = typeof item === 'string' ? JSON.parse(item) : item;
        if (parsed?.type === 'buy_hot' && parsed?.payload?.hotId === hotIdToFind) {
          parsed.type = 'buy_hot_collected'; // Modifies original status reference flags
        }
        return JSON.stringify(parsed);
      });

      // Clear structural array data before rewriting pure lists down pipeline operations
      await redis.del(listKey);

      await Promise.all([
        redis.hset(rootUserKey, { availableBalance: String(wallet) }),
        redis.rpush(listKey, ...updatedHistoryArray.reverse()), // Restores history stack index paths
        redis.lpush(listKey, JSON.stringify(txItem))
      ]);

      const freshHistory = await redis.lrange(listKey, 0, -1);
      const parsedData = parseAndCategorizeList(freshHistory);
      
      return NextResponse.json({ success: true, wallet, history: parsedData.history });
    }

    return NextResponse.json({ success: false, error: "Action error" }, { status: 400 });
  } catch (err) {
    console.error('[HOT POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}