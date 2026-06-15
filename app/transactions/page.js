'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export default function Transactions() {
  const [tx, setTx] = useState([])
  const [user, setUser] = useState(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchTransactions = useCallback(async (phone) => {
    setLoading(true)
    try {
      const url = `/api/user?action=getTransactions&phone=${encodeURIComponent(phone)}`
      console.log('[TX] Fetching:', url)

      const res = await fetch(url)
      const data = await res.json()

      console.log('[TX] API response:', data)

      if (data.success) {
        setTx(data.transactions || [])
      } else {
        console.error('Failed to fetch transactions:', data.message)
        setTx([])
      }
    } catch (err) {
      console.error('Failed to fetch transactions:', err)
      setTx([])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('palamedes_user') || 'null')
    if (!u) return router.push('/login')

    // Auto-fix phone if leading 0 is missing
    if (u.phone &&!u.phone.startsWith('0') && u.phone.length === 9) {
      u.phone = '0' + u.phone
      localStorage.setItem('palamedes_user', JSON.stringify(u))
      console.log('[TX] Fixed phone to:', u.phone)
    }

    console.log('[TX] Using phone:', u.phone)
    setUser(u)
    fetchTransactions(u.phone)

    // Listen for refresh event from deposit page
    const handleRefresh = () => {
      console.log('[TX] Refresh event received')
      fetchTransactions(u.phone)
    }
    window.addEventListener('refreshTransactions', handleRefresh)

    // Also refresh when tab becomes visible again
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        console.log('[TX] Tab visible, refreshing')
        fetchTransactions(u.phone)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('refreshTransactions', handleRefresh)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [router, fetchTransactions])

  if (!user) return null

  const formatDate = (iso) => {
    if (!iso) return 'invalid date'
    const d = new Date(iso)
    const day = d.toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala', day: '2-digit' })
    const month = d.toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala', month: '2-digit' })
    const year = d.toLocaleDateString('en-GB', { timeZone: 'Africa/Kampala', year: 'numeric' })
    const time = d.toLocaleTimeString('en-US', {
      timeZone: 'Africa/Kampala',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).toLowerCase()
    return `${day}/${month}/${year} ${time}`
  }

  const filteredTx = filter === 'all'? tx : tx.filter(t => t.type === filter)

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'deposit', label: 'Deposit' },
    { key: 'withdraw', label: 'Withdraw' },
    { key: 'daily_income', label: 'Daily income' },
    { key: 'viptask_purchase', label: 'VIP Purchase' },
    { key: 'referral_reward', label: 'Referral Reward' },
    { key: 'share_purchase', label: 'Share Purchase' },
    { key: 'share_profit', label: 'Share Profit' },
    { key: 'refund', label: 'Refund' }
  ]

  const txName = (type) => {
    const names = {
      deposit: 'Deposit',
      withdraw: 'Withdraw',
      daily_income: 'Daily income',
      viptask_purchase: 'VIP Purchase',
      referral_reward: 'Referral Reward',
      share_purchase: 'Share Purchase',
      share_profit: 'Share Profit',
      refund: 'Refund'
    }
    return names[type] || type.replace(/_/g, ' ')
  }

  const getStatus = (status) => {
    if (status === 'pending') return { text: 'Pending', color: '#f59e0b' }
    if (status === 'rejected') return { text: 'Rejected', color: '#ef4444' }
    return { text: 'Success', color: '#22c55e' }
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f5f5f5', padding: '20px' }}>
      <div style={{ maxWidth: '650px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', marginRight: '15px' }}
          >
            ←
          </button>
          <h1 style={{ fontSize: '22px', fontWeight: '600', color: '#000' }}>Transactions</h1>
        </div>

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
          {loading? (
            <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>Loading...</p>
          ) : filteredTx.length === 0? (
            <p style={{ textAlign: 'center', color: '#999', padding: '40px 0' }}>No transactions yet</p>
          ) : (
            filteredTx.map((t) => {
              const isCredit = t.amount > 0
              const { text: statusText, color: statusColor } = getStatus(t.status)
              const displayAmount = Math.abs(t.amount).toLocaleString()

              return (
                <div
                  key={t.id || t.date}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px',
                    borderBottom: '1px solid #eee',
                    backgroundColor: t.status === 'pending'? '#fef3c7' : 'white',
                    borderRadius: '8px',
                    marginBottom: '8px'
                  }}
                >
                  <div>
                    <p style={{ fontSize: '16px', fontWeight: '500', color: '#000', marginBottom: '4px' }}>
                      {txName(t.type)}
                    </p>
                    <p style={{ fontSize: '13px', color: '#777' }}>{formatDate(t.date)}</p>
                    {t.method && (
                      <p style={{ fontSize: '12px', color: '#999', marginTop: '2px' }}>{t.method}</p>
                    )}
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <p style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: isCredit? '#22c55e' : '#000',
                      marginBottom: '4px'
                    }}>
                      {isCredit? '+' : '-'}{displayAmount}shs
                    </p>
                    <p style={{ fontSize: '13px', fontWeight: '600', color: statusColor }}>
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