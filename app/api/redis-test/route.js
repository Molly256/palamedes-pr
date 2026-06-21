import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export async function GET() {
  await redis.set('test', 'it works')
  const val = await redis.get('test')
  return Response.json({ status: 'connected', value: val })
}