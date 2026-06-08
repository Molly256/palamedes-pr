import { redis } from '../../lib/redis'

export default async function Test() {
  try {
    await redis.set('pal:test', 'Hello Palamedes')
    const val = await redis.get('pal:test')
    return (
      <div style={{padding:50, fontSize:24, textAlign:'center'}}>
        ✅ Redis says: {val}
      </div>
    )
  } catch (e) {
    return (
      <div style={{padding:50, color:'red', fontSize:18}}>
        ❌ Error: {e.message}
      </div>
    )
  }
}