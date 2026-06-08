import { db } from '../../lib/redis'

export default async function Test() {
  try {
    await db.set('test', 'Hello Palamedes')
    const val = await db.get('test')
    return <div style={{padding:50,fontSize:24}}>✅ Redis says: {val}</div>
  } catch (e) {
    return <div style={{padding:50,color:'red'}}>❌ Error: {e.message}</div>
  }
}