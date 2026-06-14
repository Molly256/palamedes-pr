"use client"
import { useState, useEffect } from "react"
import booksData from "../../data/books.json"

const SKYBLUE = "#00BFFF"

export default function TasksPage() {
  const [user, setUser] = useState(null)
  const [tasks, setTasks] = useState([])
  const [todayBooks, setTodayBooks] = useState([])
  const [readingBook, setReadingBook] = useState(null)
  const [timer, setTimer] = useState(10)
  const [showPopup, setShowPopup] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)

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

      const books = taskList.slice(0, 4).map((task) => {
        const bookNum = Number(task.bookId)
        return {
          taskId: task.id,
          bookNum,
          title: booksData[bookNum - 1]?.title || `Book ${bookNum}`,
          cover: booksData[bookNum - 1]?.cover || booksData[0]?.cover,
          preview: booksData[bookNum - 1]?.preview || "",
          status: task.status
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
        b.taskId === readingBook.taskId? {...b, status: 'read' } : b
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
      b.taskId === book.taskId? {...b, status: 'reading' } : b
    ))
  }

  const handlePopupOk = () => {
    setShowPopup(false)
    setTimer(10)
  }

  const handleSubmit = async (book) => {
    if (submittingId || book.status!== 'read') return

    setSubmittingId(book.taskId)
    try {
      const res = await fetch('/api/tasks/submit-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: user.phone,
          taskId: book.taskId
        })
      })

      const data = await res.json()

      if (data.success) {
        const newBalance = Number(user.balance) + Number(data.reward)
        const updatedUser = {...user, balance: newBalance }
        setUser(updatedUser)
        localStorage.setItem('palamedes_user', JSON.stringify(updatedUser))

        setTodayBooks(prev => prev.map(b =>
          b.taskId === book.taskId? {...b, status: 'submitted' } : b
        ))

        alert(`+${Number(data.reward).toLocaleString()}shs added!`)
        localStorage.setItem('palamedes_refresh_my', 'true')
      } else {
        alert(data.message || 'Failed to submit')
      }
    } catch (err) {
      console.error(err)
      alert('Network error')
    } finally {
      setSubmittingId(null)
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

  const pendingCount = todayBooks.filter(b => b.status!== 'submitted').length
  const doneCount = todayBooks.filter(b => b.status === 'submitted').length

  return (
    <div style={{ padding: 20, background: "#FFFFFF", minHeight: "100vh", color: "#000" }}>
      <h2 style={{ marginBottom: 20, fontWeight: "400", color: "#000" }}>
        Today's Tasks - VIP{user.vip} {doneCount}/4 Done
      </h2>

      {todayBooks.length === 0? (
        <p style={{ textAlign: "center", marginTop: 100, color: "#666" }}>
          No tasks available
        </p>
      ) : (
        todayBooks.map((book) => {
          const isRead = book.status === 'read'
          const isReading = book.status === 'reading'
          const isSubmitted = book.status === 'submitted'

          return (
            <div key={book.taskId} style={{
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
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => handleRead(book)}
                    disabled={isRead || isReading || isSubmitted}
                    style={{
                      padding: "8px 16px",
                      background: isRead || isSubmitted? "#E0E0E0" : isReading? "#B0B0B0" : SKYBLUE,
                      border: "none",
                      borderRadius: 6,
                      fontWeight: "400",
                      cursor: (isRead || isReading || isSubmitted)? "not-allowed" : "pointer",
                      color: "#000",
                      opacity: (isRead || isReading || isSubmitted)? 0.6 : 1
                    }}
                  >
                    {isSubmitted? "Done" : isRead? "Read ✓" : isReading? "Reading..." : "Read"}
                  </button>

                  <button
                    onClick={() => handleSubmit(book)}
                    disabled={!isRead || submittingId === book.taskId}
                    style={{
                      padding: "8px 16px",
                      background: isRead? "#4CAF50" : "#E0E0E0",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: "400",
                      cursor:!isRead || submittingId === book.taskId? "not-allowed" : "pointer",
                      color: "#000",
                      opacity:!isRead || submittingId === book.taskId? 0.6 : 1
                    }}
                  >
                    {submittingId === book.taskId? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          )
        })
      )}

      {doneCount === 4 && (
        <p style={{ textAlign: "center", marginTop: 40, fontSize: 18, color: "#4CAF50", fontWeight: "600" }}>
          Tasks done for today 4/4
        </p>
      )}
    </div>
  )
}