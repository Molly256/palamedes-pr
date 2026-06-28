export const dynamic = 'force-dynamic';
export const revalidate = 0;

'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import AvatarWithBadge from '../../components/AvatarWithBadge'
import { VIPS } from '@/app/config/vips'

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export default function BooksPage() {
  const [user, setUser] = useState(null)
  const [books, setBooks] = useState([])
  const [readingBook, setReadingBook] = useState(null)
  const [timer, setTimer] = useState(10)
  const lockRef = useRef(new Set())

  const fetchBooks = async (phone, silent = false) => {
    try {
      const today = getUgandaDateString()
      const [coversRes, dataRes] = await Promise.all([
        fetch(`/api/books/covers?phone=${phone}&date=${today}`, { cache: 'no-store' }),
        fetch(`/api/books/data?phone=${phone}&date=${today}`, { cache: 'no-store' })
      ]);
      
      const coversJson = await coversRes.json(); 
      const dataJson = await dataRes.json();     

      // API returns object: {success: true, books: [...]}
      if (coversJson.success && dataJson.success) {
        const idSet = new Set(coversJson.covers.map(c => String(c.id)));
        const mergedBooks = dataJson.books
          .filter(b => idSet.has(String(b.id)))
          .map(b => ({
            bookId: String(b.id),
            title: b.title,
            author: b.author,
            preview: b.preview_page || 'No preview', // from books.json
            cover: `/books/covers/${String(b.id)}.jpg`, // public/books/covers/
            status: 'pending' 
          }));
        
        setBooks(mergedBooks);
        if (!silent) {
          const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
          setUser(userData)
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
  }, [])

  useEffect(() => {
    if (!readingBook) return
    if (timer === 0) { setReadingBook(null); setTimer(10); return }
    const t = setTimeout(() => setTimer(timer - 1), 1000)
    return () => clearTimeout(t)
  }, [readingBook, timer])

  const handleRead = async (book) => {
    if (book.status !== 'pending') return
    if (lockRef.current.has(`r-${book.bookId}`)) return
    lockRef.current.add(`r-${book.bookId}`)
    setBooks(prev => prev.map(b => b.bookId === book.bookId ? {...b, status: 'read'} : b))
    setReadingBook(book)
    setTimer(10)
    fetch('/api/books/submit', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, 
      body: JSON.stringify({ phone: user.phone, bookId: book.bookId, action: 'read', title: book.title, cover: book.cover }) 
    })
      .catch(err => { 
        console.error('Read error:', err); 
        setBooks(prev => prev.map(b => b.bookId === book.bookId ? {...b, status: 'pending'} : b)) 
      })
      .finally(() => { 
        lockRef.current.delete(`r-${book.bookId}`) 
      })
  }

  const handleSubmit = async (book) => {
    if (book.status !== 'read') return alert('Click Read first')
    if (lockRef.current.has(`s-${book.bookId}`)) return
    lockRef.current.add(`s-${book.bookId}`)
    setBooks(prev => prev.map(b => b.bookId === book.bookId ? {...b, status: 'submitted'} : b))
    try {
      const res = await fetch('/api/books/submit', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, 
        body: JSON.stringify({ phone: user.phone, bookId: book.bookId, action: 'submit', title: book.title, cover: book.cover }) 
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 409) { await fetchBooks(user.phone, true); return }
        throw new Error(data.error || 'Submit failed')
      }
      setUser(data.user)
      localStorage.setItem('palamedes_user', JSON.stringify(data.user))
      await fetchBooks(user.phone, true)
    } catch(err) {
      console.error('Submit error:', err)
      alert(err.message)
      setBooks(prev => prev.map(b => b.bookId === book.bookId ? {...b, status: 'read'} : b))
    } finally {
      lockRef.current.delete(`s-${book.bookId}`)
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
              {pendingBooks.map(book => {
                const isRead = book.status === 'read'
                return (
                  <div key={book.bookId} style={{ background: '#f5f5f5', borderRadius: '12px', padding: '15px', display: 'flex', gap: '15px', alignItems: 'center' }}>
                    <img src={book.cover} alt={book.title} style={{ width: 80, height: 120, objectFit: 'cover', borderRadius: 8 }} />
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#000' }}>{book.title}</h3>
                      <p style={{ margin: '4px 0 10px', fontSize: '13px', color: '#666' }}>{book.author}</p>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <button onClick={() => handleRead(book)} disabled={isRead} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: isRead ? '#9ca3af' : '#00BFFF', color: '#000', fontWeight: '700', cursor: isRead ? 'not-allowed' : 'pointer' }}>{isRead ? '✓ Read' : 'Read'}</button>
                        <button onClick={() => handleSubmit(book)} disabled={!isRead} style={{ flex: 1, padding: '10px', borderRadius: '8px', border: 'none', background: isRead ? '#00BFFF' : '#9ca3af', color: '#000', fontWeight: '700', cursor: !isRead ? 'not-allowed' : 'pointer' }}>Submit </button>
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