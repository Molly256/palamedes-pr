import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let sql: NeonQueryFunction<boolean, boolean> | null = null

export const db: NeonQueryFunction<boolean, boolean> = (strings, ...values) => {
  if (!sql) {
    console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL)
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set')
    }
    sql = neon(process.env.DATABASE_URL)
  }
  return sql(strings, ...values)
}