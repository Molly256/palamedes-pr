import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export const db = {
  get: (key) => redis.get(`pal:${key}`),
  set: (key, value) => redis.set(`pal:${key}`, value),
  del: (key) => redis.del(`pal:${key}`),
  hgetall: (key) => redis.hgetall(`pal:${key}`),
  hset: (key, obj) => redis.hset(`pal:${key}`, obj)
}