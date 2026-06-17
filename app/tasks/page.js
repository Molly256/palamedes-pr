"use client"
import { useState, useEffect } from "react"

const SKYBLUE = "#00BFFF"

export default function TasksPage() {
  const [user, setUser] = useState(null)
  const [tasks, setTasks] = useState([])
  const [readingBook, setReadingBook] = useState(null)
  const [timer, setTimer] = useState(10)
  const [showPopup, setShowPopup] = useState(false)
  const [submittingId, setSubmittingId] = useState(null)

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    const phone = userData.phone
    
    if (!phone) return
    
    setUser(userData)
    fetchTasks(phone)
  }, [])

  const fetchTasks = async (phone) => {
    try {
      const res = await fetch(`/api/tasks?phone=${encodeURIComponent(phone)}`)
      const data = await res.json()

      if (!data.success) {
        setTasks([])
        return
      }

      // Update user from API response if available - this fixes stale localStorage data
      if (data.user) {
        setUser(data.user)
        localStorage.setItem('palamedes_user', JSON.stringify(data.user))
      }

      // Backend returns { books: [...] }
      const mappedTasks = (data.books || []).map((book) => ({
        bookId: book.id,
        taskId: book.id,
        title: book.title,
        cover: book.cover,
        preview: book.preview,
        status: book.status, // "pending" or "submitted"
        reward: book.reward
      }))

      setTasks(mappedTasks)
    } catch (err) {
      console.error('fetchTasks error:', err)
      setTasks([])
    }
  }

  useEffect(() => {
    if (!readingBook || timer === 0) return
    const t = setTimeout(() => setTimer(timer - 1), 1000)

    if (timer === 1) {
      setTasks(prev => prev.map(b =>
        b.bookId === readingBook.bookId ? { ...b, status: 'read' } : b
      ))
      setShowPopup(true)
      setReadingBook(null)
    }
    return () => clearTimeout(t)
  }, [timer, readingBook])

  const handleRead = (book) => {
    if (book.status !== 'pending' || readingBook) return
    setReadingBook(book)
    setTimer(10)
    setShowPopup(false)

    setTasks(prev => prev.map(b =>
      b.bookId === book.bookId ? { ...b, status: 'reading' } : b
    ))
  }

  const handlePopupOk = () => {
    setShowPopup(false)
    setTimer(10)
  }

  const handleSubmit = async (book) => {
    if (submittingId || book.status !== 'read') return

    setSubmittingId(book.taskId)
    try {
      const phone = user.phone
      const res = await fetch('/api/tasks/submit-one', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phone,
          bookId: book.bookId
        })
      })

      const data = await res.json()

      if (data.success) {
        setTasks(prev => prev.map(b =>
          b.bookId === book.bookId ? { ...b, status: 'submitted' } : b
        ))

        alert(`+${Number(data.reward).toLocaleString()}shs added!`)
        
        localStorage.setItem('palamedes_refresh_my', 'true')
        window.dispatchEvent(new Event('refreshTransactions'))
        window.dispatchEvent(new Event('focus'))
        
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

  // Fixed: handle boolean, string, and number values from KV
  const hasBoughtVIP = user.hasBoughtVIP === 'true' || user.hasBoughtVIP === true || user.hasBoughtVIP === 1
  const vipLabel = hasBoughtVIP ? `VIP ${user.vip || ''}`.trim() : 'Internship'
  const doneCount = tasks.filter(b => b.status === 'submitted').length

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

  return (
    <div style={{ padding: 20, background: "#FFFFFF", minHeight: "100vh", color: "#000" }}>
      <h2 style={{ marginBottom: 20, fontWeight: "400", color: "#000" }}>
        Today's Tasks - {vipLabel} {doneCount}/{tasks.length} Done
      </h2>

      {!hasBoughtVIP ? (
        <div style={{ textAlign: "center", marginTop: 100 }}>
          <p style={{ fontSize: 16, color: "#666", marginBottom: 15 }}>
            Buy VIP to unlock daily tasks
          </p>
          <a href="/viptasks" style={{ 
            display: "inline-block", 
            padding: "10px 20px", 
            background: SKYBLUE, 
            color: "#000", 
            borderRadius: 8, 
            textDecoration: "none",
            fontWeight: "600"
          }}>
            Go to VIP Tasks
          </a>
        </div>
      ) : tasks.length === 0 ? (
        <p style={{ textAlign: "center", marginTop: 100, color: "#666" }}>
          No tasks available
        </p>
      ) : (
        tasks.map((book) => {
          const isRead = book.status === 'read'
          const isReading = book.status === 'reading'
          const isSubmitted = book.status === 'submitted'
          const isPending = book.status === 'pending'

          return (
            <div key={book.bookId} style={{
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
                <p style={{ margin: "0 0 10px 0", fontSize: 14, color: "#4CAF50" }}>
                  +UGX {book.reward}
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => handleRead(book)}
                    disabled={!isPending || isReading}
                    style={{
                      padding: "8px 16px",
                      background: isPending ? SKYBLUE : "#E0E0E0",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: "400",
                      cursor: isPending ? "pointer" : "not-allowed",
                      color: "#000",
                      opacity: isPending ? 1 : 0.6
                    }}
                  >
                    {isSubmitted ? "Done" : isRead ? "Read ✓" : isReading ? "Reading..." : "Read"}
                  </button>

                  <button
                    onClick={() => handleSubmit(book)}
                    disabled={book.status !== 'read' || submittingId === book.taskId}
                    style={{
                      padding: "8px 16px",
                      background: book.status === 'read' ? "#4CAF50" : "#E0E0E0",
                      border: "none",
                      borderRadius: 6,
                      fontWeight: "400",
                      cursor: book.status === 'read' && !submittingId ? "pointer" : "not-allowed",
                      color: "#000",
                      opacity: book.status === 'read' && !submittingId ? 1 : 0.6
                    }}
                  >
                    {submittingId === book.taskId ? "Submitting..." : "Submit"}
                  </button>
                </div>
              </div>
            </div>
          )
        })
      )}

      {hasBoughtVIP && doneCount === tasks.length && tasks.length > 0 && (
        <p style={{ textAlign: "center", marginTop: 40, fontSize: 18, color: "#4CAF50", fontWeight: "600" }}>
          Tasks done for today {doneCount}/{tasks.length}
        </p>
      )}
    </div>
  )
}