"use client"
import { useState, useEffect } from "react"
import booksData from "../../data/books.json"

const SKYBLUE = "#00BFFF"

const VIP_CONFIG = {
 0: { books: 4 },
 1: { books: 4 },
 2: { books: 4 },
 3: { books: 4 },
 4: { books: 5 },
 5: { books: 5 },
 6: { books: 5 },
 7: { books: 5 },
 8: { books: 5 },
 9: { books: 5 },
 10: { books: 5 },
}

export default function TasksPage() {
  const [user, setUser] = useState(null)
  const [tasks, setTasks] = useState(null)
  const [todayBooks, setTodayBooks] = useState([])
  const [readingBook, setReadingBook] = useState(null)
  const [timer, setTimer] = useState(10)
  const [showPopup, setShowPopup] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!userData.phone) return
    setUser(userData)
    fetchTasks(userData.phone)
  }, [])

  const fetchTasks = async (phone) => {
    const res = await fetch(`/api/user?phone=${phone}`)
    const data = await res.json()
    if (data.success) {
      setUser(data.user)
      setTasks(data.tasks)

      if (data.tasks) {
        const maxBooks = VIP_CONFIG[data.user.vip]?.books || 0
        const bookKeys = Object.keys(data.tasks)
         .filter(k => k.startsWith('book'))
         .slice(0, maxBooks) // only take allowed amount

        const books = bookKeys.map((key, idx) => {
          const bookNum = idx + 1 // 1-based for API
          return {
          ...booksData[idx % booksData.length], // distribute freely from booksData
            bookNum, // internal only, not used in UI
            status: data.tasks[key],
            taskKey: key // "book1", "book2", etc
          }
        })

        setTodayBooks(books)
      } else {
        setTodayBooks([])
      }
    }
  }

  useEffect(() => {
    if (!readingBook || timer === 0) return
    const t = setTimeout(() => setTimer(timer - 1), 1000)

    if (timer === 1) {
      setTasks(prev => {
        if (!prev ||!(readingBook.taskKey in prev)) return prev
        return {...prev, [readingBook.taskKey]: 'read' }
      })

      setTodayBooks(prev => prev.map(b =>
        b.taskKey === readingBook.taskKey? {...b, status: 'read' } : b
      ))
      setShowPopup(true)
    }
    return () => clearTimeout(t)
  }, [timer, readingBook])

  const handleRead = (book) => {
    if (book.status === 'read' || book.status === 'submitted') return
    setReadingBook(book)
    setTimer(10)
    setShowPopup(false)
  }

  const handlePopupOk = () => {
    setShowPopup(false)
    setReadingBook(null)
    setTimer(10)
  }

  const handleSubmit = async (bookNum) => {
    if (!user || loading) return

    console.log("Submitting bookNumber:", bookNum)

    const maxBooks = VIP_CONFIG[user.vip]?.books || 0
    if (bookNum > maxBooks) {
      alert(`Invalid book for VIP${user.vip}`)
      await fetchTasks(user.phone)
      return
    }

    const fresh = await fetch(`/api/user?phone=${user.phone}`)
    const freshData = await fresh.json()
    if (!freshData.success) {
      alert('Failed to refresh tasks')
      return
    }

    const bookKey = `book${bookNum}`
    if (!freshData.tasks[bookKey]) {
      alert('Invalid book for your VIP level')
      await fetchTasks(user.phone)
      return
    }

    if (freshData.tasks[bookKey] === 'submitted') {
      await fetchTasks(user.phone)
      alert('Already submitted')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submitTask',
          phone: user.phone,
          bookNumber: bookNum
        })
      })

      const data = await res.json()
      if (data.success) {
        const oldBalance = user.balance
        setUser(prev => ({...prev, balance: data.balance }))
        localStorage.setItem('palamedes_user', JSON.stringify({...prev, balance: data.balance }))

        await fetchTasks(user.phone)
        alert(`+${data.balance - oldBalance}shs added!`)
      } else {
        alert(data.message || 'Failed to submit task')
      }
    } catch (err) {
      alert('Network error')
    }
    setLoading(false)
  }

  if (!user) return <div style={{ padding: 20 }}>Loading...</div>

  if (readingBook) {
    return (
      <div style={{ padding: 20, minHeight: "100vh", background: "#FFFFFF", color: "#000" }}>
        <button onClick={() => { setReadingBook(null); setTimer(10) }} style={{
          marginBottom: 20, padding: "8px 16px", background: "#F5F5F5", border: "1px solid #E0E0E0",
          borderRadius: 6, color: "#000", cursor: "pointer", fontWeight: "400"
        }}>← Back</button>

        <h2 style={{ marginBottom: 15, fontWeight: "400", color: "#000" }}>{readingBook.title}</h2>
        <p style={{ fontSize: 16, lineHeight: 1.7, color: "#333" }}>{readingBook.preview}</p>

        <div style={{ position: "fixed", top: 20, right: 20, fontSize: 22, fontWeight: "400", color: SKYBLUE }}>
          {timer}s
        </div>

        {showPopup && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
          }}>
            <div style={{ background: "#FFFFFF", padding: 30, borderRadius: 16, textAlign: "center", border: `2px solid ${SKYBLUE}` }}>
              <h3 style={{ color: "#000", margin: "0 0 10px 0", fontSize: 24, fontWeight: "400" }}>Time Complete ⌛</h3>
              <p style={{ color: "#666", fontSize: 14, marginBottom: 15 }}>Tap Submit on tasks page to claim</p>
              <button onClick={handlePopupOk} style={{
                padding: "12px 24px", background: SKYBLUE, border: "none",
                borderRadius: 8, fontWeight: "400", cursor: "pointer", fontSize: 16, color: "#000"
              }}>
                OK
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const pendingBooks = todayBooks.filter(b => b.status === 'pending' || b.status === 'read')
  const submittedBooks = todayBooks.filter(b => b.status === 'submitted')

  return (
    <div style={{ padding: 20, background: "#FFFFFF", minHeight: "100vh", color: "#000" }}>
      <h2 style={{ marginBottom: 20, fontWeight: "400", color: "#000" }}>
        Today's Tasks - VIP{user.vip}
        {user.vipLocked === 'true' && <span style={{ color: SKYBLUE, fontSize: 14 }}> [Locked]</span>}
      </h2>

      {pendingBooks.length === 0 && submittedBooks.length === 0? (
        <p style={{ textAlign: "center", marginTop: 100, color: "#666" }}>
          {user.vipLocked === 'true'? "Tasks locked. Wait for next weekday." : "No tasks available"}
        </p>
      ) : (
        pendingBooks.map((book, idx) => {
          const isRead = book.status === 'read' || book.status === 'submitted'
          const canSubmit = book.status === 'read'

          return (
            <div key={book.taskKey} style={{
              padding: 15, marginBottom: 18, display: "flex", gap: 15, alignItems: "center",
              borderBottom: "1px solid #E0E0E0"
            }}>
              <img src={book.cover} alt={book.title} style={{
                width: 70, height: 100, objectFit: "cover", borderRadius: 8
              }} />
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 10px 0", fontWeight: "400", color: "#000", fontSize: 16 }}>
                  {book.title}
                </h4>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={() => handleRead(book)}
                    disabled={isRead}
                    style={{
                      padding: "8px 16px",
                      background: isRead? "#E0E0E0" : SKYBLUE,
                      border: "none",
                      borderRadius: 6,
                      fontWeight: "400",
                      cursor: isRead? "not-allowed" : "pointer",
                      color: "#000",
                      opacity: isRead? 0.6 : 1
                    }}
                  >
                    {isRead? "Read ✓" : "Read"}
                  </button>
                  <button
                    onClick={() => handleSubmit(book.bookNum)}
                    disabled={loading ||!canSubmit}
                    style={{
                      padding: "8px 16px",
                      background: SKYBLUE,
                      border: "none",
                      borderRadius: 6,
                      color: "#000",
                      cursor: loading ||!canSubmit? "not-allowed" : "pointer",
                      fontWeight: "400",
                      opacity: loading ||!canSubmit? 0.6 : 1
                    }}
                  >
                    {loading? 'Submitting...' : 'Submit'}
                  </button>
                </div>
              </div>
            </div>
          )
        })
      )}

      <h2 style={{ marginTop: 40, marginBottom: 20, fontWeight: "400", color: "#000" }}>
        Completed Tasks ({submittedBooks.length}/{todayBooks.length})
      </h2>
      {submittedBooks.length === 0? (
        <p style={{ color: "#666" }}>No completed tasks yet</p>
      ) : (
        submittedBooks.map(book => (
          <div key={book.taskKey} style={{
            padding: 12, marginBottom: 10, display: "flex", gap: 12, alignItems: "center",
            borderBottom: "1px solid #E0E0E0"
          }}>
            <img src={book.cover} style={{ width: 50, height: 75, objectFit: "cover", borderRadius: 6 }} />
            <p style={{ margin: 0, fontWeight: "400", color: "#000" }}>{book.title}</p>
          </div>
        ))
      )}
    </div>
  )
}