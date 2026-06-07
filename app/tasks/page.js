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

  useEffect(() => {
    const savedRead = localStorage.getItem('readBooks')
    if(savedRead) setReadBooks(JSON.parse(savedRead))
  }, [])

  useEffect(() => {
    localStorage.setItem('readBooks', JSON.stringify(readBooks))
  }, [readBooks])

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

    if(readBooks.includes(bookId) &&!completed.find(b => b.id === bookId)) {
      const earning = VIP_EARNINGS[userVip] || 625

      const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
      const newBalance = (userData.balance || 0) + earning
      localStorage.setItem('palamedes_user', JSON.stringify({...userData, balance: newBalance}))

      setCompleted(prev => [...prev, {...book}])
      setTodayBooks(prev => prev.filter(b => b.id!== bookId))
    }
  }

  if(readingBook) {
    return (
      <div style={{padding: 20, minHeight: "100vh", background: "#FFFFFF", color: "#000"}}>
        <button onClick={() => {setReadingBook(null); setTimer(10)}} style={{
          marginBottom: 20, padding: "8px 16px", background: "#F5F5F5", border: "1px solid #E0E0E0",
          borderRadius: 6, color: "#000", cursor: "pointer", fontWeight: "400"
        }}>← Back</button>

        <h2 style={{marginBottom: 15, fontWeight: "400", color: "#000"}}>{readingBook.title}</h2>
        <p style={{fontSize: 16, lineHeight: 1.7, color: "#333"}}>{readingBook.preview}</p>

        <div style={{position: "fixed", top: 20, right: 20, fontSize: 22, fontWeight: "400", color: SKYBLUE}}>
          {timer}s
        </div>

        {showPopup && (
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
            background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100
          }}>
            <div style={{background: "#FFFFFF", padding: 30, borderRadius: 16, textAlign: "center", border: `2px solid ${SKYBLUE}`}}>
              <h3 style={{color: "#000", margin: "0 0 10px 0", fontSize: 24, fontWeight: "400"}}>Time Complete ⌛</h3>
              <p style={{color: "#666", fontSize: 14, marginBottom: 15}}>Tap Submit on tasks page to claim</p>
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
    <div style={{padding: 20, background: "#FFFFFF", minHeight: "100vh", color: "#000"}}>
      <h2 style={{marginBottom: 20, fontWeight: "400", color: "#000"}}>Today's Tasks</h2>

      {todayBooks.length === 0? (
        <p style={{textAlign: "center", marginTop: 100, color: "#666"}}>No books found</p>
      ) : (
        todayBooks.map(book => {
          const isRead = readBooks.includes(book.id)
          return (
            <div key={book.id} style={{
              padding: 15, marginBottom: 18, display: "flex", gap: 15, alignItems: "center",
              borderBottom: "1px solid #E0E0E0"
            }}>
              <img src={book.cover} alt={book.title} style={{
                width: 70, height: 100, objectFit: "cover", borderRadius: 8
              }} />
              <div style={{flex: 1}}>
                <h4 style={{margin: "0 0 10px 0", fontWeight: "400", color: "#000", fontSize: 16}}>{book.title}</h4>
                <div style={{display: "flex", gap: 10}}>
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
                  <button onClick={() => handleSubmit(book.id)} style={{
                    padding: "8px 16px",
                    background: SKYBLUE,
                    border: "none",
                    borderRadius: 6,
                    color: "#000",
                    cursor: "pointer",
                    fontWeight: "400"
                  }}>
                    Submit
                  </button>
                </div>
              </div>
            </div>
          )
        })
      )}

      <h2 style={{marginTop: 40, marginBottom: 20, fontWeight: "400", color: "#000"}}>Completed Tasks</h2>
      {completed.length === 0? (
        <p style={{color: "#666"}}>No completed tasks yet</p>
      ) : (
        completed.map(book => (
          <div key={book.id} style={{
            padding: 12, marginBottom: 10, display: "flex", gap: 12, alignItems: "center",
            borderBottom: "1px solid #E0E0E0"
          }}>
            <img src={book.cover} style={{width: 50, height: 75, objectFit: "cover", borderRadius: 6}} />
            <p style={{margin: 0, fontWeight: "400", color: "#000"}}>{book.title}</p>
          </div>
        ))
      )}
    </div>
  )
}