   import { kv } from '@vercel/kv'
   export async function GET() {
     await kv.hset('test:check', 'balance', '12345')
     await new Promise(r => setTimeout(r, 100))
     const data = await kv.hgetall('test:check')
     return Response.json({ data })
   }