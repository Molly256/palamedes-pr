"use client"
import { useState, useEffect } from "react"
import booksData from "../../data/books.json"

const SKYBLUE = "#00BFFF"

const VIP_CONFIG = {
 0: { books: 4, incomePerBook: 625 },
 1: { books: 4, incomePerBook: 625 },
 2: { books: 4, incomePerBook: 2000 },
 3: { books: 4, incomePerBook: 6500 },
 4: { books: 5, incomePerBook: 7000 },
 5: { books: 5, incomePerBook: 10000 },
 6: { books: 5, incomePerBook: 14000 },
 7: { books: 5, incomePerBook: 28000 },
 8: { books: 5, incomePerBook: 32000 },
 9: { books: 5, incomePerBook: 40000 },
 10: { books: 5, incomePerBook: 60000 },
}

export default function TasksPage() {
  const [user, setUser] = useState(null)
  const [tasks, setTasks] = useState([])
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
    try {
      const res = await fetch(`/api/tasks?phone=${phone}`)
      const data = await res.json()

      if (!data.success) {
        setTodayBooks([])
        return
      }

      const userRes = await fetch(`/api/user?phone=${phone}`)
      const userData = await userRes.json()
      if (userData.success) {
        setUser(userData.user)
        localStorage.setItem('palamedes_user', JSON.stringify(userData.user))
      }

      const taskList = data.tasks || []
      setTasks(taskList)

      const maxBooks = VIP_CONFIG[userData.user?.vip || 0]?.books || 0
      const books = taskList.slice(0, maxBooks).map((task) => {
        const bookNum = Number(task.bookId)
        return {
          bookNum,
          taskKey: `book${bookNum}`,
          taskId: task.id,
          title: booksData[bookNum - 1]?.title || `Book ${bookNum}`,
          cover: booksData[bookNum - 1]?.cover || booksData[0]?.cover,
          preview: booksData[bookNum - 1]?.preview || "",
          status: task.status,
          reward: task.reward
        }
      })
      setTodayBooks(books)
    } catch (err) {
      console.error('fetchTasks error:', err)
      setTodayBooks([])
    }
  }

  useEffect(() => {
    if (!readingBook || timer === 0) return
    const t = setTimeout(() => setTimer(timer - 1), 1000)

    if (timer === 1) {
      setTodayBooks(prev => prev.map(b =>
        b.taskKey === readingBook.taskKey? {...b, status: 'read' } : b
      ))
      setShowPopup(true)
      setReadingBook(null)
    }
    return () => clearTimeout(t)
  }, [timer, readingBook])

  const handleRead = (book) => {
    if (book.status!== 'pending' || readingBook) return
    setReadingBook(book)
    setTimer(10)
    setShowPopup(false)

    setTodayBooks(prev => prev.map(b =>
      b.taskKey === book.taskKey? {...b, status: 'reading' } : b
    ))
  }

  const handlePopupOk = async () => {
    setShowPopup(false)
    setTimer(10)

    if (!readingBook ||!user) return

    // Submit this single book immediately
    setLoading(true)
    try {
      const res = await fetch('/api/tasks/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: user.phone,
          taskIncome: readingBook.reward
        })
      })

      const data = await res.json()

      if (data.success) {
        const newBalance = Number(user.balance) + readingBook.reward
        const updatedUser = {...user, balance: newBalance }
        setUser(updatedUser)
        localStorage.setItem('palamedes_user', JSON.stringify(updatedUser))

        setTodayBooks(prev => prev.map(b =>
          b.taskKey === readingBook.taskKey? {...b, status: 'submitted' } : b
        ))

        alert(`+${readingBook.reward.toLocaleString()}shs added!`)
        localStorage.setItem('palamedes_refresh_my', 'true')
      } else {
        alert(data.message || 'Failed to submit')
        // revert status back to pending if failed
        setTodayBooks(prev => prev.map(b =>
          b.taskKey === readingBook.taskKey? {...b, status: 'pending' } : b
        ))
      }
    } catch (err) {
      console.error(err)
      alert('Network error')
    } finally {
      setLoading(false)
    }
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
              <p style={{ color: "#666", fontSize: 14, marginBottom: 15 }}>+{readingBook.reward.toLocaleString()}shs will be added</p>
              <button onClick={handlePopupOk} disabled={loading} style={{
                padding: "12px 24px", background: SKYBLUE, border: "none",
                borderRadius: 8, fontWeight: "400", cursor: loading? "not-allowed" : "pointer",
                fontSize: 16, color: "#000", opacity: loading? 0.6 : 1
              }}>
                {loading? 'Adding...' : 'OK'}
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }

  const pendingBooks = todayBooks.filter(b => b.status === 'pending' || b.status === 'reading' || b.status === 'read')
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
        pendingBooks.map((book) => {
          const isRead = book.status === 'read' || book.status === 'submitted'
          const isReading = book.status === 'reading'

          return (
            <div key={book.taskKey} style={{
              padding: 15, marginBottom: 18, display: "flex", gap: 15, alignItems: "center",
              borderBottom: "1px solid #E0E0E0"
            }}>
              <img src={book.cover} alt={book.title} style={{
                width: 70, height: 100, objectFit: "cover", borderRadius: 8
              }} />
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: "0 0 5px 0", fontWeight: "400", color: "#000", fontSize: 16 }}>
                  {book.title}
                </h4>
                <p style={{ margin: "0 0 10px 0", fontSize: 14, color: SKYBLUE }}>
                  +{book.reward.toLocaleString()}shs
                </p>
                <button
                  onClick={() => handleRead(book)}
                  disabled={isRead || isReading}
                  style={{
                    padding: "8px 16px",
                    background: isRead? "#E0E0E0" : isReading? "#B0B0B0" : SKYBLUE,
                    border: "none",
                    borderRadius: 6,
                    fontWeight: "400",
                    cursor: (isRead || isReading)? "not-allowed" : "pointer",
                    color: "#000",
                    opacity: (isRead || isReading)? 0.6 : 1
                  }}
                >
                  {isRead? "Read ✓" : isReading? "Reading..." : "Read"}
                </button>
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
            <div>
              <p style={{ margin: 0, fontWeight: "400", color: "#000" }}>{book.title}</p>
              <p style={{ margin: 0, fontSize: 13, color: SKYBLUE }}>+{book.reward.toLocaleString()}shs</p>
            </div>
          </div>
        ))
      )}
    </div>
  )
}