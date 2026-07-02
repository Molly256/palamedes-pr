import { NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = Redis.fromEnv();
const toNum = (v, f = 0) => { const n = Number(v); return Number.isNaN(n) ? f : n; };

// FIXED: Single point of truth for date generation (Returns full 4-digit year: YYYY-MM-DD)
const getTodayDateStr = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Kampala" }));
  const yyyy = String(d.getFullYear()); // Keeps full year (e.g. 2026)
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

    // FIXED: Support 'shares' type categorization alongside 'buy_hot'
    if ((parsed.type === 'buy_hot' || parsed.type === 'shares') && parsed.payload) {
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

    console.log('[SHARES GET] Profile:', rootUserKey, 'List:', listKey);

    const [userProfile, rawHistory] = await Promise.all([
      redis.hgetall(rootUserKey),
      redis.lrange(listKey, 0, -1)
    ]);
    
    if (!userProfile || Object.keys(userProfile).length === 0) {
      return NextResponse.json({ success: true, wallet: 0, ongoing: [], expired: [], history: [] });
    }

    const wallet = toNum(userProfile.availableBalance);
    const { history, ongoing, expired } = parseAndCategorizeList(rawHistory);

    return NextResponse.json({ success: true, wallet, ongoing, expired, history });
  } catch (err) {
    console.error('[SHARES GET] Error:', err);
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
    
    console.log('[SHARES POST] Action:', action, 'Profile:', rootUserKey, 'List:', listKey);

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

    // FIXED: Matches either 'BUY_HOT' or 'BUY_SHARES' actions
    if (action === 'BUY_HOT' || action === 'BUY_SHARES') {
      const price = toNum(payload?.price);
      if (wallet < price) return NextResponse.json({ success: false, error: "Insufficient balance" }, { status: 400 });

      wallet = wallet - price;
      
      // FIXED: Storing the transaction type explicitly as 'shares'
      const txItem = { 
        id: uuid,
        type: 'shares',
        amount: String(-price),
        note: `Bought share ${payload?.newHotInstance?.title || 'Item'}`,
        status: 'completed',
        createdAt: timestampStr,
        payload: payload?.newHotInstance 
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
        payload: hot 
      };

      // Support clearing out completed types for both 'buy_hot' and 'shares'
      const updatedHistoryArray = rawHistory.map(item => {
        let parsed = typeof item === 'string' ? JSON.parse(item) : item;
        if ((parsed?.type === 'buy_hot' || parsed?.type === 'shares') && parsed?.payload?.hotId === hotIdToFind) {
          parsed.type = 'shares_collected'; 
        }
        return JSON.stringify(parsed);
      });

      await redis.del(listKey);

      await Promise.all([
        redis.hset(rootUserKey, { availableBalance: String(wallet) }),
        redis.rpush(listKey, ...updatedHistoryArray.reverse()), 
        redis.lpush(listKey, JSON.stringify(txItem))
      ]);

      const freshHistory = await redis.lrange(listKey, 0, -1);
      const parsedData = parseAndCategorizeList(freshHistory);
      
      return NextResponse.json({ success: true, wallet, history: parsedData.history });
    }

    return NextResponse.json({ success: false, error: "Action error" }, { status: 400 });
  } catch (err) {
    console.error('[SHARES POST] Error:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}