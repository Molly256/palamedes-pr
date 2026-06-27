import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  const coversPath = path.join(process.cwd(), 'public', 'books', 'covers')
  
  let ids = []
  try {
    ids = fs.readdirSync(coversPath)
      .filter(name => name.endsWith('.jpg')) // only jpg
      .map(name => name.replace('.jpg', '')) // "11.jpg" -> "11"
      .sort((a, b) => Number(a) - Number(b)) // numeric sort 1,2,3,10
  } catch {
    ids = [] // folder missing = no books
  }
  
  return NextResponse.json({ ids }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}