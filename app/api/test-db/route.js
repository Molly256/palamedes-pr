import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await db`SELECT 1 as ok, NOW() as time`
    return NextResponse.json({
      success: true,
      dbConnected: true,
      result: result[0]
    })
  } catch (err) {
    return NextResponse.json({
      success: false,
      dbConnected: false,
      error: err.message
    }, { status: 500 })
  }
}