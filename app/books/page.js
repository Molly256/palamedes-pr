'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AvatarWithBadge from '../../components/AvatarWithBadge'

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export default function BooksPage() {
  const [user, setUser] = useState(null)
  const [allBooksMeta, setAllBooksMeta] = useState([])
  const [userBooks, setUserBooks] = useState([])
  const [readingBook, setReadingBook] = useState(null)
  const [timer, setTimer] = useState(10)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!userData.phone) return
    setUser(userData)
    fetch('/data/books.json').then(r => r.json()).then(setAllBooksMeta)
    fetchUserBooks(userData.phone)
  }, [])

  const fetchUserBooks = async (phone) => {
    try {
      const today = getUgandaDateString()
      const res = await fetch(`/api/books/today?phone=${phone}&date=${today}`)
      const data = await res.json()
      if (data.success) {
        setUser(data.user)
        setUserBooks(data.books || [])
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

  // FIX: URL changed from /api/submit to /api/books/submit
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
      fetchUserBooks(user.phone)
    } catch (err) {
      console.error('Save read error:', err)
    }
  }

  // FIX: URL changed from /api/submit to /api/books/submit
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
      fetchUserBooks(user.phone)
      alert(`+${data.earned.toLocaleString()}shs added to your balance`)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user || allBooksMeta.length === 0) return null
  const vip = Number(user.vip || 0)

  const booksToShow = userBooks.map(b => {
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
        </div>
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px', color: '#000' }}>BOOKS</h2>

      {vip === 0? (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <Link href="/viplevels">
            <button style={{
              padding: '14px 40px', borderRadius: '50px', border: 'none',
              background: '#00BFFF', color: '#000', fontWeight: '700', fontSize: '16px',
              cursor: 'pointer'
            }}>
              Buy VIP Level
            </button>
          </Link>
        </div>
      ) : booksToShow.length === 0? (
        <div style={{ textAlign: 'center', marginTop: 60, color: '#666' }}>
          <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: 8, color: '#000' }}>
            No books assigned yet
          </p>
          <p style={{ fontSize: '13px' }}>
            Buy VIP to get books for today, or wait for admin to assign tomorrow
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {booksToShow.map(book => {
            const isCompleted = book.status === 'completed'
            const isRead = book.status === 'read'
            return (
              <div key={book.bookId} style={{
                background: '#f5f5f5', borderRadius: '12px', padding: '15px',
                display: 'flex', gap: '15px', alignItems: 'center'
              }}>
                <img 
                  src={book.cover} 
                  alt={book.title} 
                  style={{ width: 80, height: 120, objectFit: 'cover', borderRadius: 8 }}
                  onError={(e) => { e.target.src = '/books/covers/placeholder.jpg' }}
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
                      disabled={isCompleted || isRead}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                        background: isCompleted? '#ccc' : isRead? '#10b981' : '#00BFFF', color: '#000',
                        fontWeight: '700', cursor: (isCompleted || isRead)? 'not-allowed' : 'pointer'
                      }}
                    >
                      {isCompleted? '✓ Submitted' : isRead? '✓ Read' : 'Read'}
                    </button>
                    <button
                      onClick={() => handleSubmit(book)}
                      disabled={!isRead || isCompleted || loading}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                        background: isCompleted? '#ccc' : '#00BFFF', color: '#000',
                        fontWeight: '700', cursor: (!isRead || isCompleted)? 'not-allowed' : 'pointer',
                        opacity: loading? 0.6 : 1
                      }}
                    >
                      {isCompleted? 'Done' : 'Submit'}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}