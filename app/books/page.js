'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AvatarWithBadge from '../components/AvatarWithBadge'

export default function BooksPage() {
  const [user, setUser] = useState(null)
  const [allBooks, setAllBooks] = useState([])
  const [readingBook, setReadingBook] = useState(null)
  const [timer, setTimer] = useState(10)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!userData.phone) return
    setUser(userData)
    fetch('/data/books.json').then(r => r.json()).then(setAllBooks)
  }, [])

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

  const handleRead = (book) => {
    const completed = user.completedBooks || []
    if (completed.includes(book.id.toString())) return
    setReadingBook(book)
    setTimer(10)
  }

  const handleSubmit = async (book) => {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/books/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: user.phone, bookId: book.id.toString() })
      })
      const data = await res.json()
      if (!data.success) {
        alert(data.message)
        setLoading(false)
        return
      }
      setUser(data.user)
      localStorage.setItem('palamedes_user', JSON.stringify(data.user))
      alert(`+${data.earned.toLocaleString()}shs added to your balance`)
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  const vip = Number(user.vip || 0)
  const unlockedIds = user.unlockedBooks || []
  const completedIds = user.completedBooks || []

  // Get VIP config to know how many books to show
  const VIPS = {
    1: { books: 4 }, 2: { books: 4 }, 3: { books: 4 },
    4: { books: 5 }, 5: { books: 5 }, 6: { books: 5 },
    7: { books: 5 }, 8: { books: 5 }, 9: { books: 5 }, 10: { books: 5 }
  }
  const booksToShow = VIPS[vip]?.books || 0
  const userBooks = allBooks.filter(b => unlockedIds.includes(b.id.toString())).slice(0, booksToShow)

  // Reader modal
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
      ) : userBooks.length === 0? (
        <div style={{ textAlign: 'center', marginTop: 60, color: '#666' }}>
          <p style={{ fontSize: '16px', fontWeight: '700', marginBottom: 8, color: '#000' }}>
            No books available today
          </p>
          <p style={{ fontSize: '13px' }}>
            Books are assigned Monday to Friday. Check back on the next weekday.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {userBooks.map(book => {
            const isCompleted = completedIds.includes(book.id.toString())
            return (
              <div key={book.id} style={{
                background: '#f5f5f5', borderRadius: '12px', padding: '15px',
                display: 'flex', gap: '15px', alignItems: 'center'
              }}>
                <img src={book.cover} alt={book.title} style={{ width: 80, height: 120, objectFit: 'cover', borderRadius: 8 }} />
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#000' }}>{book.title}</h3>
                  <p style={{ margin: '4px 0 10px', fontSize: '13px', color: '#666' }}>{book.author}</p>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => handleRead(book)}
                      disabled={isCompleted}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                        background: isCompleted? '#ccc' : '#00BFFF', color: '#000',
                        fontWeight: '700', cursor: isCompleted? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                      }}
                    >
                      {isCompleted? '✓ Read' : 'Read'}
                    </button>
                    <button
                      onClick={() => handleSubmit(book)}
                      disabled={isCompleted || loading}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                        background: isCompleted? '#ccc' : '#00BFFF', color: '#000',
                        fontWeight: '700', cursor: isCompleted? 'not-allowed' : 'pointer',
                        opacity: loading? 0.6 : 1
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
    </main>
  )
}