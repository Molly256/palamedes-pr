'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import AvatarWithBadge from '../../components/AvatarWithBadge'

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export default function BooksPage() {
  const [user, setUser] = useState(null)
  const [books, setBooks] = useState([])
  const [readingBook, setReadingBook] = useState(null)
  const [timer, setTimer] = useState(10)
  const [submittingIds, setSubmittingIds] = useState(new Set()) // <- Hard lock per bookId
  const pollIntervalRef = useRef(null)

  const fetchBooks = async (phone) => {
    try {
      const today = getUgandaDateString()
      const res = await fetch(`/api/books/data?phone=${phone}&date=${today}`, { cache: 'no-store' })
      const data = await res.json()
      if (data.success) {
        setBooks(data.books || [])
        if (data.user) {
          setUser(data.user)
          localStorage.setItem('palamedes_user', JSON.stringify(data.user))
        }
      }
    } catch (err) {
      console.error('Fetch books error:', err)
    }
  }

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!userData.phone) return
    setUser(userData)
    fetchBooks(userData.phone)

    pollIntervalRef.current = setInterval(() => fetchBooks(userData.phone), 10000)
    const handleVisibility = () => { if (document.visibilityState === 'visible') fetchBooks(userData.phone) }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(pollIntervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  useEffect(() => {
    if (!readingBook) return
    if (timer === 0) { setReadingBook(null); setTimer(10); return }
    const t = setTimeout(() => setTimer(timer - 1), 1000)
    return () => clearTimeout(t)
  }, [readingBook, timer])

  const handleRead = async (book) => {
    if (book.status !== 'pending') return
    setReadingBook(book)
    setTimer(10)
    await fetch('/api/books/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: user.phone, bookId: book.bookId, action: 'read' })
    })
    await fetchBooks(user.phone)
  }

  const handleSubmit = async (book) => {
    if (book.status !== 'read') return alert('Click Read first')
    if (submittingIds.has(book.bookId)) return // <- Block 2nd tap instantly

    const today = getUgandaDateString()
    const idempotencyKey = `${user.phone}:${today}:${book.bookId}:${Date.now()}` // <- Unique per tap
    
    setSubmittingIds(prev => new Set(prev).add(book.bookId)) // <- Lock UI immediately

    try {
      const res = await fetch('/api/books/submit', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ phone: user.phone, bookId: book.bookId, action: 'submit', idempotencyKey }) // <- SEND KEY
      })
      
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || `Server ${res.status}`)
      
      setUser(data.user)
      localStorage.setItem('palamedes_user', JSON.stringify(data.user))
      await fetchBooks(user.phone)
      alert(`+${data.earned.toLocaleString()}shs added`)
    } catch (err) {
      console.error('Submit error:', err)
      alert(err.message)
    } finally {
      setSubmittingIds(prev => { // <- Unlock only after finish/error
        const next = new Set(prev)
        next.delete(book.bookId)
        return next
      })
    }
  }

  if (!user) return null
  const vip = Number(user.vip || 0)
  const pendingBooks = books.filter(b => b.status === 'pending' || b.status === 'read')
  const completedBooks = books.filter(b => b.status === 'submitted')

  if (readingBook) {
    return (
      <main style={{ minHeight: '100vh', background: '#000', color: '#fff', padding: '20px', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 20, right: 20, fontSize: '24px', fontWeight: '900' }}>{timer}s</div>
        <h2 style={{ marginBottom: 20 }}>{readingBook.title}</h2>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.6, maxHeight: '80vh', overflowY: 'auto' }}>{readingBook.preview}</pre>
        <p style={{ textAlign: 'center', marginTop: 20 }}>Returning to BOOKS in {timer}s...</p>
      </main>
    )
  }

  return (
    <main style={{ minHeight: '100vh', background: '#FFFFFF', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '30px' }}>
        <Link href="/dashboard" style={{ fontSize: '16px', color: '#00BFFF', fontWeight: '900', textDecoration: 'none', paddingTop: '8px' }}>← Back</Link>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <AvatarWithBadge username={user.username} vipLevel={vip} size={60} />
          <p style={{ margin: '8px 0 0', fontWeight: '900', color: '#000', fontSize: '15px' }}>Balance: {user.availableBalance?.toLocaleString() || 0} shs</p>
          <Link href="/transactions" style={{ margin: '4px 0 0', fontSize: '12px', color: '#00BFFF', fontWeight: '700', textDecoration: 'none' }}>Transaction History</Link>
        </div>
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px', color: '#000' }}>BOOKS</h2>

      {vip === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <Link href="/viplevels"><button style={{ padding: '14px 40px', borderRadius: '50px', border: 'none', background: '#00BFFF', color: '#000', fontWeight: '700', fontSize: '16px', cursor: 'pointer' }}>Buy VIP Level</button></Link>
        </div>
      ) : books.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 20, color: '#666' }}><p style={{ fontSize: '16px', fontWeight: '700', marginBottom: 8, color: '#000' }}>No books for today yet</p><p style={{ fontSize: '12px' }}>Auto-refreshing...</p></div>
      ) : (
        <>
          {pendingBooks.length > 0 && (
            <div style={{ display: 'grid', gap: '20px', marginBottom: '40px' }}>
              {pendingBooks.map(book => {
                const isRead = book.status === 'read'
                const isSubmitting = submittingIds.has(book.bookId) // <- NEW
                return (
                  <div key={book.bookId} style={{ background: '#f5f5f5', borderRadius: '12px', padding: '15px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <img src={book.cover} alt={book.title} style={{ width: 80, height: 120, objectFit: 'cover', borderRadius: 8 }} />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#000' }}>{book.title}</h3>
                      <p style={{ margin: '4px 0 10px', fontSize: '13px', color: '#666' }}>{book.author}</p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleRead(book)} disabled={isRead} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: isRead ? '#10b981' : '#00BFFF', color: '#000', fontWeight: '700', cursor: isRead ? 'not-allowed' : 'pointer' }}>{isRead ? '✓ Read' : 'Read'}</button>
                        <button 
                          onClick={() => handleSubmit(book)} 
                          disabled={!isRead || isSubmitting} // <- NEW: Hard lock
                          style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: '#00BFFF', color: '#000', fontWeight: '700', cursor: !isRead ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.6 : 1 }}
                        >
                          {isSubmitting ? 'Submitting...' : 'Submit'} 
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

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
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}