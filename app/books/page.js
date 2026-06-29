'use client'
export const dynamic = 'force-dynamic';

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
  const lockRef = useRef(new Set())

  const fetchBooks = async (phone) => {
    try {
      const today = getUgandaDateString()
      const res = await fetch(`/api/books/data?phone=${phone}&date=${today}`, { cache: 'no-store' })
      const dataJson = await res.json()
      if (dataJson.success) {
        const mergedBooks = dataJson.books.map(function(b) {
          return Object.assign({}, b, { cover: '/books/covers/' + b.bookId + '.jpg' })
        })
        setBooks(mergedBooks)
      }
    } catch (err) {
      console.error('Fetch books error:', err)
    }
  }

  useEffect(function() {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!userData.phone) return
    setUser(userData)
    fetchBooks(userData.phone)
  }, [])

  useEffect(function() {
    if (!readingBook) return
    if (timer === 0) { 
      setReadingBook(null)
      setTimer(10)
      // FIX 1: Added )}; to close map() + setBooks()
      setBooks(function(prev) { return prev.map(function(b) { return b.bookId === readingBook.bookId ? Object.assign({}, b, { status: 'read' }) : b })
      return 
    }
    const t = setTimeout(function() { setTimer(timer - 1) }, 1000)
    return function() { clearTimeout(t) }
  }, [readingBook, timer])

  const handleRead = function(book) {
    if (book.status !== 'pending') return
    if (lockRef.current.has('r-' + book.bookId)) return
    lockRef.current.add('r-' + book.bookId)
    setReadingBook(book)
    setTimer(10)
    lockRef.current.delete('r-' + book.bookId)
  }

  const handleSubmit = async function(book) {
    if (book.status !== 'read') return alert('Finish reading first')
    if (lockRef.current.has('s-' + book.bookId)) return
    lockRef.current.add('s-' + book.bookId)
    
    // FIX 2: Added )}; to close map() + setBooks()
    setBooks(function(prev) { return prev.map(function(b) { return b.bookId === book.bookId ? Object.assign({}, b, { status: 'submitted' }) : b })
    
    try {
      const res = await fetch('/api/books/submit', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, 
        body: JSON.stringify({ phone: user.phone, bookId: book.bookId })
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) { await fetchBooks(user.phone); return }
        throw new Error(data.error || 'Submit failed')
      }
      const newUser = Object.assign({}, user, { availableBalance: data.availableBalance })
      setUser(newUser)
      localStorage.setItem('palamedes_user', JSON.stringify(newUser))
    } catch(err) {
      setBooks(function(prev) { return prev.map(function(b) { return b.bookId === book.bookId ? Object.assign({}, b, { status: 'read' }) : b })
    } finally {
      lockRef.current.delete('s-' + book.bookId)
    }
  }

  if (!user) return null
  const vip = Number(user.vip || 0)
  const pendingBooks = books.filter(function(b) { return b.status === 'pending' || b.status === 'read' })
  const completedBooks = books.filter(function(b) { return b.status === 'submitted' })

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
          <p style={{ margin: '8px 0 0', fontWeight: '900', color: '#000', fontSize: '15px' }}>Balance: {Number(user.availableBalance || 0).toLocaleString()} shs</p>
          <Link href="/transactions" style={{ margin: '4px 0 0', fontSize: '12px', color: '#00BFFF', fontWeight: '700', textDecoration: 'none' }}>Transaction History</Link>
        </div>
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px', color: '#000' }}>BOOKS</h2>

      {vip === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 60 }}>
          <Link href="/viplevels"><button style={{ padding: '14px 40px', borderRadius: '50px', border: 'none', background: '#00BFFF', color: '#000', fontWeight: '700', fontSize: '16px', cursor: 'pointer' }}>Buy VIP Level</button></Link>
        </div>
      ) : books.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 20, color: '#666' }}><p style={{ fontSize: '16px', fontWeight: '700', marginBottom: 8, color: '#000' }}>No books for today yet</p></div>
      ) : (
        <>
          {pendingBooks.length > 0 && (
            <div style={{ display: 'grid', gap: '20px', marginBottom: '40px' }}>
              {pendingBooks.map(function(book) {
                const isRead = book.status === 'read'
                return (
                  <div key={book.bookId} style={{ background: '#f5f5f5', borderRadius: '12px', padding: '15px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <img src={book.cover} alt={book.title} style={{ width: 80, height: 120, objectFit: 'cover', borderRadius: 8 }} />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#000' }}>{book.title}</h3>
                      <p style={{ margin: '4px 0 10px', fontSize: '13px', color: '#666' }}>{book.author}</p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={function() { handleRead(book) }} disabled={isRead} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: isRead ? '#9ca3af' : '#00BFFF', color: '#000', fontWeight: '700', cursor: isRead ? 'not-allowed' : 'pointer' }}>{isRead ? '✓ Read' : 'Read'}</button>
                        <button onClick={function() { handleSubmit(book) }} disabled={!isRead} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: isRead ? '#00BFFF' : '#9ca3af', color: '#000', fontWeight: '700', cursor: !isRead ? 'not-allowed' : 'pointer' }}>Submit</button>
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
                {completedBooks.map(function(book) {
                  return (
                    <div key={book.bookId} style={{ background: '#f5f5f5', borderRadius: '12px', padding: '15px', display: 'flex', gap: '15px', alignItems: 'center', opacity: 0.7 }}>
                      <img src={book.cover} alt={book.title} style={{ width: 80, height: 120, objectFit: 'cover', borderRadius: 8 }} />
                      <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#000' }}>{book.title}</h3>
                        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#666' }}>{book.author}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </>
      )}
    </main>
  )
}