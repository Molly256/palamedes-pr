'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function Transactions() {
  const [tx, setTx] = useState([])
  const [user, setUser] = useState(null)
  const [filter, setFilter] = useState('all')
  const router = useRouter()

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('palamedes_user') || 'null')
    if (!u) return router.push('/login')
    setUser(u)
    const all = JSON.parse(localStorage.getItem('palamedes_transactions') || '[]')
    setTx(all.filter(t => t.number === u.number).sort((a,b) => new Date(b.date) - new Date(a.date)))
  }, [router])

  if (!user) return null

  const formatDate = (iso) => {
    if (!iso) return 'invalid date'

    const d = new Date(iso)

    // Force Africa/Kampala timezone - no more split('-') so no undefined
    const day = d.toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala', day: '2-digit' })
    const month = d.toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala', month: '2-digit' })
    const year = d.toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala', year: 'numeric' })

    const time = d.toLocaleTimeString('en-US', {
      timeZone: 'Africa/Kampala',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toLowerCase()

    return `${day}/${month}/${year}/${time}`
  }

  const filteredTx = filter === 'all'? tx : tx.filter(t => t.type === filter)

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'deposit', label: 'Deposit' },
    { key: 'withdraw', label: 'Withdraw' },
    { key: 'daily_income', label: 'Daily income' },
    { key: 'viptask_purchase', label: 'Viptask purchase' },
    { key: 'invitation_reward', label: 'Invitation reward' }
  ]

  const txName = (type) => {
    const names = {
      deposit: 'Deposit',
      withdraw: 'Withdraw',
      daily_income: 'Daily income',
      viptask_purchase: 'Viptask purchase',
      invitation_reward: 'Invitation reward'
    }
    return names[type] || type
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f5', padding: '20px' }}>
      <div style={{ maxWidth: '650px', margin: '0 auto' }}>

        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px' }}>
          <button onClick={() => router.back()} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', marginRight: '15px' }}>←</button>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#000' }}>Transactions</h1>
        </div>

        {/* Headers Tabs */}
        <div style={{ display: 'flex', gap: '6px', marginBottom: '15px', overflowX: 'auto', paddingBottom: '8px' }}>
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              style={{
                padding: '8px 12px',
                borderRadius: '18px',
                border: filter === tab.key? '2px solid #000' : '1px solid #ccc',
                background: filter === tab.key? '#000' : '#fff',
                color: filter === tab.key? '#87CEEB' : '#444',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', padding: '15px' }}>
          {filteredTx.length === 0? (
            <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>No transactions yet</p>
          ) : (
            filteredTx.map((t) => {
              const isWithdraw = t.type === 'withdraw'
              const statusText = t.status === 'pending'? 'Pending' : isWithdraw? 'Success' : 'Approved'
              const statusColor = t.status === 'pending'? '#d32f2f' : '#2e7d32'
              const displayAmount = Math.abs(t.amount).toLocaleString()

              return (
                <div key={t.id} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '16px 0',
                  borderBottom: '1px solid #eee'
                }}>
                  <div>
                    <p style={{ fontSize: '16px', fontWeight: '500', color: '#000', marginBottom: '4px' }}>
                      {txName(t.type)}
                    </p>
                    <p style={{ fontSize: '13px', color: '#777' }}>{formatDate(t.date)}</p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: '16px', fontWeight: '300', color: '#000', marginBottom: '4px' }}>
                      shs {displayAmount}
                    </p>
                    <p style={{ fontSize: '13px', fontWeight: '500', color: statusColor }}>
                      {statusText}
                    </p>
                  </div>
                </div>
              )
            })
          )}
        </div>

      </div>
    </main>
  )
}