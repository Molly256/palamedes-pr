"use client"
import { useState, useEffect } from "react"
import booksData from "../../data/books.json"

// VIP earnings table
const VIP_EARNINGS = {
 0: 625, // Intern
 1: 625, // VIP1
 2: 2000, // VIP2
 3: 6500, // VIP3
 4: 12000,
 5: 25000,
 6: 50000,
 7: 100000,
 8: 200000,
 9: 400000,
 10: 800000
}

const SKYBLUE = "#00BFFF"

export default function TasksPage() {
  const userVip = 2 // TODO: Replace with actual user VIP level from DB
  const [todayBooks, setTodayBooks] = useState([])
  const [completed, setCompleted] = useState([])
  const [readingBook, setReadingBook] = useState(null)
  const [timer, setTimer] = useState(10)
  const [showPopup, setShowPopup] = useState(false)
  const [readBooks, setReadBooks] = useState([])

  // Save read books to browser so button stays disabled after refresh
  useEffect(() => {
    const savedRead = localStorage.getItem('readBooks')
    if(savedRead) setReadBooks(JSON.parse(savedRead))
  }, [])

  useEffect(() => {
    localStorage.setItem('readBooks', JSON.stringify(readBooks))
  }, [readBooks])

  // Load today's 4 books
  useEffect(() => {
    const kampala = new Date().toLocaleString("en-US", {timeZone: "Africa/Kampala"})
    const date = new Date(kampala)
    const day = date.getDay()

    const dayIndex = day === 0? 6 : day - 1
    const total = booksData.length
    const start = (dayIndex * 4) % total

    const tasks = []
    for(let i = 0; i < 4; i++) {
      const idx = (start + i) % total
      tasks.push(booksData[idx])
    }
    setTodayBooks(tasks)
  }, [])

  // 10s timer - skyblue
  useEffect(() => {
    if(!readingBook || timer === 0) return
    const t = setTimeout(() => setTimer(timer - 1), 1000)
    if(timer === 1) setShowPopup(true)
    return () => clearTimeout(t)
  }, [timer, readingBook])

  const handleRead = (book) => {
    if(readBooks.includes(book.id)) return
    setReadingBook(book)
    setTimer(10)
    setShowPopup(false)
    setReadBooks(prev => [...prev, book.id])
  }

  const handlePopupOk = () => {
    setShowPopup(false)
    setReadingBook(null)
    setTimer(10)
  }

  const handleSubmit = (bookId) => {
    const book = todayBooks.find(b => b.id === bookId)
    if(!book) return

    // Only add if user actually read it + not already submitted
    if(readBooks.includes(bookId) &&!completed.find(b => b.id === bookId)) {
      const earning = VIP_EARNINGS[userVip] || 625

      // TODO: Send earning to Dashboard API
      // await fetch('/api/add-balance', {method: 'POST', body: JSON.stringify({amount: earning})})

      setCompleted(prev => [...prev, {...book, earning}])
      setTodayBooks(prev => prev.filter(b => b.id!== bookId))
    }
  }

  // Reader page
  if(readingBook) {
    return (
      <div style={{padding: 20, minHeight: "100vh", background: "#0a0a0a", color: "#fff"}}>
        <button onClick={() => {setReadingBook(null); setTimer(10)}} style={{
          marginBottom: 20, padding: "8px 16px", background: "#333", border: "none",
          borderRadius: 6, color: "#fff", cursor: "pointer"
        }}>← Back</button>

        <h2 style={{marginBottom: 15}}>{readingBook.title}</h2>
        <p style={{fontSize: 16, lineHeight: 1.7, color: "#ccc"}}>{readingBook.preview}</p>

        <div style={{position: "fixed", top: 20, right: 20, fontSize: 22, fontWeight: "bold", color: SKYBLUE}}>
          {timer}s
        </div>

        {showPopup && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
          }}>
            <div style={{background: "#1a1a1a", padding: 30, borderRadius: 16, textAlign: "center", border: `2px solid ${SKYBLUE}`}}>
              <h3 style={{color: SKYBLUE, margin: "0 0 10px 0", fontSize: 24}}>Earn {VIP_EARNINGS[userVip]}shs</h3>
              <p style={{color: "#aaa", fontSize: 14, marginBottom: 15}}>Tap Submit on tasks page to claim</p>
              <button onClick={handlePopupOk} style={{
                padding: "12px 24px", background: SKYBLUE, border: "none",
                borderRadius: 8, fontWeight: "bold", cursor: "pointer", fontSize: 16, color: "#000"
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
    <div style={{padding: 20, background: "#0a0a0a", minHeight: "100vh", color: "#fff"}}>
      <h2 style={{marginBottom: 20}}>Today's Tasks</h2>

      {todayBooks.length === 0? (
        <p style={{textAlign: "center", marginTop: 100, color: "#888"}}>No books found</p>
      ) : (
        todayBooks.map(book => {
          const isRead = readBooks.includes(book.id)
          return (
            <div key={book.id} style={{
              background: "#1a1a1a", borderRadius: 12, padding: 15, marginBottom: 15,
              border: "1px solid #333", display: "flex", gap: 15, alignItems: "center"
            }}>
              <img src={book.cover} alt={book.title} style={{
                width: 70, height: 100, objectFit: "cover", borderRadius: 8
              }} />
              <div style={{flex: 1}}>
                <h4 style={{margin: "0 0 8px 0"}}>{book.title}</h4>
                <div style={{display: "flex", gap: 10}}>
                  <button
                    onClick={() => handleRead(book)}
                    disabled={isRead}
                    style={{
                      padding: "8px 16px",
                      background: isRead? "#444" : SKYBLUE,
                      border: "none",
                      borderRadius: 6,
                      fontWeight: "bold",
                      cursor: isRead? "not-allowed" : "pointer",
                      color: "#000",
                      opacity: isRead? 0.5 : 1
                    }}
                  >
                    {isRead? "Read ✓" : "Read"}
                  </button>
                  <button onClick={() => handleSubmit(book.id)} style={{
                    padding: "8px 16px",
                    background: SKYBLUE,
                    border: "none",
                    borderRadius: 6,
                    color: "#000",
                    cursor: "pointer",
                    fontWeight: "bold"
                  }}>
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )
        })
      )}

      <h2 style={{marginTop: 40, marginBottom: 20}}>Completed Tasks</h2>
      {completed.length === 0? (
        <p style={{color: "#555"}}>No completed tasks yet</p>
      ) : (
        completed.map(book => (
          <div key={book.id} style={{
            background: "#111", borderRadius: 12, padding: 12, marginBottom: 10,
            border: "1px solid #222", display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between"
          }}>
            <div style={{display: "flex", gap: 12, alignItems: "center"}}>
              <img src={book.cover} style={{width: 50, height: 75, objectFit: "cover", borderRadius: 6}} />
              <p style={{margin: 0}}>{book.title}</p>
            </div>
            <span style={{color: SKYBLUE, fontWeight: "bold"}}>+{book.earning}shs</span>
          </div>
        ))
      )}
    </div>
  )
}