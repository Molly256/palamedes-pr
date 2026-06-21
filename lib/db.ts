import { neon, NeonQueryFunction } from '@neondatabase/serverless'

// Connect to Neon using DATABASE_URL
export const db: NeonQueryFunction<boolean, boolean> = neon(process.env.DATABASE_URL!)