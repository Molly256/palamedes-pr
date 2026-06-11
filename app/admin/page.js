'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const ADMIN_PHONE = '0753520252'

const cardStyle = {
  backgroundColor: 'white',
  padding: '16px',
  marginBottom: '12px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb'
}
const inputStyle = {
  width: '100%',
  height: '36px',
  padding: '0 10px',
  borderRadius: '6px',
  border: '1px solid #d1d5db',
  marginBottom: '10px'
}
const btnStyle = {
  backgroundColor: '#00BFFF',
  color: 'black',
  padding: '6px 14px',
  borderRadius: '6px',
  border: 'none',
  cursor: 'pointer',
  fontSize: '14px'
}
const dangerBtn = {...btnStyle, backgroundColor: '#ef4444', color: 'white' }
const successBtn = {...btnStyle, backgroundColor: '#22c55e', color: 'white' }

export default function AdminPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [searchPhone, setSearchPhone] = useState('')
  const [searchedUser, setSearchedUser] = useState(null)
  const [newPass, setNewPass] = useState('')
  const [pendingDeposits, setPendingDeposits] = useState([])
  const [pendingWithdraws, setPendingWithdraws] = useState([])

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!saved.phone) return router.push('/login')
    if (saved.phone!== ADMIN_PHONE) return router.push('/dashboard')

    setUser(saved)
    loadPendingTransactions()
  }, [])

  const loadPendingTransactions = async () => {
    const res = await fetch('/api/admin?action=pending')
    const data = await res.json()
    if (data.success) {
      setPendingDeposits(data.deposits)
      setPendingWithdraws(data.withdraws)
    }
  }

  const searchUser = async () => {
    if (!searchPhone) return alert('Enter phone number')
    const res = await fetch(`/api/admin?action=getUser&phone=${searchPhone}`)
    const data = await res.json()
    if (data.success) {
      setSearchedUser(data.user)
    } else {
      alert(data.message)
      setSearchedUser(null)
    }
  }

  const resetPassword = async () => {
    if (!newPass) return alert('Enter new password')
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        action: 'resetPassword',
        phone: searchedUser.phone,
        newPassword: newPass
      })
    })
    const data = await res.json()
    alert(data.message)
    if (data.success) setNewPass('')
  }

  const handleTransaction = async (txId, action, type, phone) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ action, txId, type, phone })
    })
    const data = await res.json()
    alert(data.message)
    if (data.success) loadPendingTransactions()
  }

  if (!user) return <div style={{padding: '20px'}}>Loading...</div>

  return (
    <div style={{minHeight: '100vh', backgroundColor: '#f9fafb', padding: '16px', paddingBottom: '96px'}}>
      <h1 style={{fontSize: '22px', fontWeight: 'bold', marginBottom: '16px'}}>Admin Panel</h1>

      {/* Section 1: Reset User Password */}
      <div style={cardStyle}>
        <h2 style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '12px'}}>Reset User Password</h2>

        <input
          style={inputStyle}
          placeholder="Enter user phone"
          value={searchPhone}
          onChange={(e) => setSearchPhone(e.target.value)}
        />
        <button style={btnStyle} onClick={searchUser}>Search User</button>

        {searchedUser && (
          <div style={{marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb'}}>
            <p><strong>Username:</strong> {searchedUser.username}</p>
            <p><strong>Phone:</strong> {searchedUser.phone}</p>
            <p><strong>Balance:</strong> {searchedUser.balance}shs</p>
            <p><strong>VIP:</strong> {searchedUser.vip}</p>

            <input
              style={{...inputStyle, marginTop: '12px'}}
              placeholder="Set temporary password"
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
            />
            <button style={dangerBtn} onClick={resetPassword}>Reset Password</button>
          </div>
        )}
      </div>

      {/* Section 2: Pending Deposits */}
      <div style={cardStyle}>
        <h2 style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '12px'}}>Pending Deposits</h2>
        {pendingDeposits.length === 0? (
          <p style={{color: '#6b7280'}}>No pending deposits</p>
        ) : (
          pendingDeposits.map(tx => (
            <div key={tx.id} style={{borderBottom: '1px solid #e5e7eb', padding: '10px 0'}}>
              <p><strong>Phone:</strong> {tx.phone}</p>
              <p><strong>Amount:</strong> {tx.amount}shs</p>
              <p><strong>Method:</strong> {tx.method}</p>
              <p><strong>Date:</strong> {tx.date}</p>
              <div style={{marginTop: '8px', display: 'flex', gap: '8px'}}>
                <button style={successBtn} onClick={() => handleTransaction(tx.id, 'approve', 'deposit', tx.phone)}>Confirm</button>
                <button style={dangerBtn} onClick={() => handleTransaction(tx.id, 'reject', 'deposit', tx.phone)}>Reject</button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Section 3: Pending Withdraws */}
      <div style={cardStyle}>
        <h2 style={{fontSize: '16px', fontWeight: 'bold', marginBottom: '12px'}}>Pending Withdraws</h2>
        {pendingWithdraws.length === 0? (
          <p style={{color: '#6b7280'}}>No pending withdraws</p>
        ) : (
          pendingWithdraws.map(tx => (
            <div key={tx.id} style={{borderBottom: '1px solid #e5e7eb', padding: '10px 0'}}>
              <p><strong>Phone:</strong> {tx.phone}</p>
              <p><strong>Amount:</strong> {tx.amount}shs</p>
              <p><strong>Net:</strong> {tx.netAmount}shs</p>
              <p><strong>Method:</strong> {tx.method} - {tx.number}</p>
              <p><strong>Names:</strong> {tx.names}</p>
              <p><strong>Date:</strong> {tx.date}</p>
              <div style={{marginTop: '8px', display: 'flex', gap: '8px'}}>
                <button style={successBtn} onClick={() => handleTransaction(tx.id, 'approve', 'withdraw', tx.phone)}>Confirm</button>
                <button style={dangerBtn} onClick={() => handleTransaction(tx.id, 'reject', 'withdraw', tx.phone)}>Reject</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}