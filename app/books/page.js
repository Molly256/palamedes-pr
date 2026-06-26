'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import AvatarWithBadge from '../../components/AvatarWithBadge'

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export default function BooksPage() {
  const [user, setUser] = useState(null)
  const [allBooksMeta, setAllBooksMeta] = useState([])
  const [validCoverIds, setValidCoverIds] = useState(new Set()) 
  const [userBooks, setUserBooks] = useState([])
  const [readingBook, setReadingBook] = useState(null)
  const [timer, setTimer] = useState(10)
  const [loading, setLoading] = useState(false)

  const pollIntervalRef = useRef(null)

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!userData.phone) return
    setUser(userData)

    const init = async () => {
      const [meta, covers] = await Promise.all([
        fetch('/data/books.json', { cache: 'no-store' }).then(r => r.json()),
        fetch('/api/books/covers', { cache: 'no-store' }).then(r => r.json())
      ])
      setAllBooksMeta(meta)
      setValidCoverIds(new Set(covers.ids.map(String)))
      fetchUserBooks(userData.phone)
    }
    init()

    // 1. POLL: Check Redis every 10s for new books from admin
    pollIntervalRef.current = setInterval(() => {
      fetchUserBooks(userData.phone)
    }, 10000) // 10 seconds

    // 2. FOCUS: Refresh when user comes back to the tab/app
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchUserBooks(userData.phone)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(pollIntervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const fetchUserBooks = async (phone) => {
    try {
      const today = getUgandaDateString()
      const res = await fetch(`/api/books/today?phone=${phone}&date=${today}`, {
        cache: 'no-store' // force fresh Redis read, no CDN cache
      })
      const data = await res.json()
      if (data.success) {
        setUser(data.user)
        setUserBooks(prev => {
          // Only update if data changed. Stops UI flicker every 10s
          const newStr = JSON.stringify(data.books || [])
          const oldStr = JSON.stringify(prev)
          return newStr !== oldStr ? data.books || [] : prev
        })
        localStorage.setItem('palamedes_user', JSON.stringify(data.user))
      }
    } catch (err) {
      console.error('Fetch books error:', err)
    }
  }

  useEffect(() => {
    if (!readingBook) return
    if (timer === 0) {
      setReadingBook(null)
      setTimer(10)
      return
    }
    const t = setTimeout(() => setTimer(timer - 1), 1000)
    return () => clearTimeout(t)
  }, [readingBook, timer])

  const handleRead = async (book) => {
    if (book.status === 'completed' || book.status === 'read') return
    
    setReadingBook(book)
    setTimer(10)
    
    try {
      await fetch('/api/books/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: user.phone, bookId: book.bookId, action: 'read' })
      })
      fetchUserBooks(user.phone) // status -> read
    } catch (err) {
      console.error('Save read error:', err)
    }
  }

  const handleSubmit = async (book) => {
    if (loading || book.status !== 'read') {
      if (book.status !== 'read') alert('Click Read first')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/books/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: user.phone, bookId: book.bookId, action: 'submit' })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.message)
        setLoading(false)
        return
      }
      setUser(data.user)
      localStorage.setItem('palamedes_user', JSON.stringify(data.user))
      fetchUserBooks(user.phone) // status -> completed
      alert(`+${data.earned.toLocaleString()}shs added to your balance`)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user || allBooksMeta.length === 0) return null
  const vip = Number(user.vip || 0)
  const today = getUgandaDateString()

  // Map + Filter fake IDs + 24hr only + Limit to 4
  const booksToShow = userBooks
    .filter(b => b.date === today)
    .filter(b => validCoverIds.has(String(b.bookId)))
    .slice(0, 4)
    .map(b => {
      const meta = allBooksMeta.find(m => m.id.toString() === b.bookId)
      return {
        bookId: b.bookId,
        status: b.status,
        reward: b.reward,
        title: meta?.title || `Book ${b.bookId}`,
        author: meta?.author || 'Unknown',
        preview: meta?.preview || 'No preview available',
        cover: `/books/covers/${b.bookId}.jpg`
      }
    })

  const pendingBooks = booksToShow.filter(b => b.status !== 'completed')
  const completedBooks = booksToShow.filter(b => b.status === 'completed')

  if (readingBook) {
    return (
      <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '20px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 20, right: 20, fontSize: '24px', fontWeight: '900' }}>
          {timer}s
        </div>
        <h2 style={{ marginBottom: 20 }}>{readingBook.title}</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.6, maxHeight: '80vh', overflowY: 'auto' }}>
          {readingBook.preview}
        </pre>
        <p style={{ textAlign: 'center', marginTop: 20 }}>Returning to BOOKS in {timer}s...</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: '#FFFFFF', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '30px' }}>
        <Link href="/dashboard" style={{ fontSize: '16px', color: '#00BFFF', fontWeight: '900', textDecoration: 'none', paddingTop: '8px' }}>
          ← Back
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <AvatarWithBadge username={user.username} vipLevel={vip} size={60} />
          <p style={{ margin: '8px 0 0', fontWeight: '900', color: '#000', fontSize: '15px' }}>
            Balance: {user.availableBalance?.toLocaleString() || 0} shs
          </p>
          <Link href="/transactions" style={{ margin: '4px 0 0', fontSize: '12px', color: '#00BFFF', fontWeight: '700', textDecoration: 'none' }}>
            Transaction History
          </Link>
        </div>
      </div>

      {/* SECTION 1: BOOKS */}
      <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px', color: '#000' }}>BOOKS</h2>

      {vip === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <Link href="/viplevels">
            <button style={{ padding: '14px 40px', borderRadius: '50px', border: 'none', background: '#00BFFF', color: '#000', fontWeight: '700', fontSize: '16px', cursor: 'pointer' }}>
              Buy VIP Level
            </button>
          </Link>
        </div>
      ) : pendingBooks.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 20, color: '#666' }}>
          <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: 8, color: '#000' }}>All books submitted for today</p>
          <p style={{ fontSize: '12px' }}>Auto-refreshing...</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px', marginBottom: '40px' }}>
          {pendingBooks.map(book => {
            const isRead = book.status === 'read'
            return (
              <div key={book.bookId} style={{ background: '#f5f5f5', borderRadius: '12px', padding: '15px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                <img 
                  src={book.cover} 
                  alt={book.title} 
                  style={{ width: 80, height: 120, objectFit: 'cover', borderRadius: 8 }}
                  onError={(e) => { e.target.style.display = 'none' }}
                />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#000' }}>{book.title}</h3>
                  <p style={{ margin: '4px 0 6px', fontSize: '13px', color: '#666' }}>{book.author}</p>
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#00BFFF', fontWeight: '700' }}>
                    Reward: {book.reward?.toLocaleString() || 0} shs
                  </p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleRead(book)}
                      disabled={isRead}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                        background: isRead ? '#10b981' : '#00BFFF', color: '#000',
                        fontWeight: '700', cursor: isRead ? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isRead ? '✓ Read' : 'Read'}
                    </button>
                    <button
                      onClick={() => handleSubmit(book)}
                      disabled={!isRead || loading}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                        background: '#00BFFF', color: '#000',
                        fontWeight: '700', cursor: !isRead ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* SECTION 2: COMPLETED TODAY'S BOOKS */}
      {completedBooks.length > 0 && (
        <>
          <h2 style={{ fontSize: '20px', fontWeight: '900', marginBottom: '16px', color: '#000' }}>COMPLETED TODAY'S BOOKS</h2>
          <div style={{ display: 'grid', gap: '16px', marginBottom: '40px' }}>
            {completedBooks.map(book => (
              <div key={book.bookId} style={{ background: '#f5f5f5', borderRadius: '12px', padding: '15px', display: 'flex', gap: '15px', alignItems: 'center', opacity: 0.7 }}>
                <img src={book.cover} alt={book.title} style={{ width: 80, height: 120, objectFit: 'cover', borderRadius: 8 }} />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#000' }}>{book.title}</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>{book.author}</p>
                  <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#10b981', fontWeight: '700' }}>
                    +{book.reward?.toLocaleString() || 0} shs Earned
                  </p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </main>
  )
}