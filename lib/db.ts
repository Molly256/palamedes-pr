import { neon, type NeonQueryFunction } from '@neondatabase/serverless'

let sql: NeonQueryFunction<boolean, boolean> | null = null

export const db: NeonQueryFunction<boolean, boolean> = (strings, ...values) => {
  if (!sql) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set in environment variables')
    }
    sql = neon(process.env.DATABASE_URL)
  }
  return sql(strings, ...values)
}