import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req) {
  // FIX: Add base URL fallback for Vercel
  const baseUrl = req.url.startsWith('http') ? req.url : `https://www.palamedes-pr.co.uk${req.url}`
  const { searchParams } = new URL(baseUrl)
  
  const idsParam = searchParams.get('ids') // "40739,1260,16389,11"
  
  if (!idsParam) return NextResponse.json({ success: true, covers: [] })
  
  const ids = idsParam.split(',')
  const coversPath = path.join(process.cwd(), 'public', 'books', 'covers')

  const covers = ids.map(id => {
    const filePath = path.join(coversPath, `${id}.jpg`)
    const exists = fs.existsSync(filePath)
    return { 
      id, 
      cover: exists ? `/books/covers/${id}.jpg` : '/books/covers/default.jpg' 
    }
  })
  
  return NextResponse.json({ success: true, covers }, {
    headers: { 'Cache-Control': 'no-store' }
  })
}