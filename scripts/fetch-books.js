import fs from 'fs'
import path from 'path'

const BOOKS_TO_FETCH = 100
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'books.json')
const COVERS_DIR = path.join(process.cwd(), 'public', 'books', 'covers')

// Create folders if missing
if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true })
if (!fs.existsSync(path.dirname(OUTPUT_FILE))) fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true })

async function fetchBooks() {
  const books = []
  
  console.log('Fetching 100 books from Project Gutenberg...')
  const res = await fetch(`https://gutendex.com/books/?page_size=${BOOKS_TO_FETCH}&sort=popular`)
  const data = await res.json()

  for(let i = 0; i < data.results.length; i++) {
    const book = data.results[i]
    
    try {
      // 1. Get text preview - first 500 words = ~1-2 pages
      const textUrl = book.formats['text/plain; charset=utf-8'] || book.formats['text/plain']
      const textRes = await fetch(textUrl)
      const fullText = await textRes.text()
      const preview = fullText.split(' ').slice(0, 500).join(' ') + '...'

      // 2. Download cover locally
      const coverUrl = book.formats['image/jpeg']
      let coverPath = `/books/covers/default.jpg`
      if(coverUrl) {
        const coverRes = await fetch(coverUrl)
        const buffer = await coverRes.arrayBuffer()
        const filename = `${book.id}.jpg`
        fs.writeFileSync(path.join(COVERS_DIR, filename), Buffer.from(buffer))
        coverPath = `/books/covers/${filename}`
      }

      books.push({
        id: book.id,
        title: book.title,
        author: book.authors[0]?.name || 'Unknown',
        cover: coverPath,
        preview: preview
      })

      console.log(`${i+1}/${BOOKS_TO_FETCH} Done: ${book.title}`)
      await new Promise(r => setTimeout(r, 1000)) // 1s delay so Gutenberg doesn’t block us
    } catch(e) {
      console.log(`Skipped ${book.title} - error`)
    }
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(books, null, 2))
  console.log(`\n✅ All done! Saved ${books.length} books to data/books.json`)
  console.log(`✅ Covers saved to public/books/covers/`)
}

fetchBooks()