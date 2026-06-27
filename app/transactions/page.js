'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const TABS = ['ALL', 'DEPOSIT', 'WITHDRAW', 'DAILY INCOME', 'VIPLEVEL PURCHASE', 'REFUND', 'SHARES']

// Normalize API type -> Tab name
const toTabKey = (t) => String(t || '').toLowerCase().replace(/_/g, ' ').trim()

export default function Transactions() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [allTxs, setAllTxs] = useState([])
  const [activeTab, setActiveTab] = useState('ALL')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const localUser = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!localUser.phone) {
      router.push('/login')
      return
    }
    setUser(localUser)
    loadTransactions(localUser.phone)
  }, [router])

  const loadTransactions = async (phone) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions?phone=${phone}&t=${Date.now()}`, { cache: 'no-store' })
      const data = await res.json()

      if (data.success) {
        setAllTxs(Array.isArray(data.transactions)? data.transactions : [])
      } else {
        console.error('Failed to load transactions:', data.error)
        setAllTxs([])
      }
    } catch (err) {
      console.error('Error loading transactions:', err)
      setAllTxs([])
    }
    setLoading(false)
  }

  const filteredTxs = useMemo(() => {
    if (activeTab === 'ALL') return allTxs
    const tabKey = activeTab.toLowerCase() // DAILY INCOME -> daily income
    return allTxs.filter(tx => toTabKey(tx.type) === tabKey)
  }, [allTxs, activeTab])

  const formatUgandaTime = (timestamp) => {
    const ms = Number(timestamp)
    if (!ms || isNaN(ms)) return ''
    const date = new Date(ms)
    return new Intl.DateTimeFormat('en-UG', {
      timeZone: 'Africa/Kampala',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date)
  }

  const renderTx = (tx) => {
    const typeKey = toTabKey(tx.type) // daily income, deposit, etc
    const isMoneyTx = typeKey === 'deposit' || typeKey === 'withdraw'
    const amount = Number(tx.amount) || 0
    const status = String(tx.status || '').toLowerCase()

    if (isMoneyTx) {
      return (
        <div key={tx.id} className="border border-gray-200 rounded p-3 bg-white">
          <div className="flex justify-between items-start">
            <div className="flex flex-col">
              <p className="text-black text-sm font-light capitalize">{typeKey}</p>
              <p className="text-gray-600 text-base font-light mt-1">
                {amount.toLocaleString()}shs
              </p>
              <p className="text-black text-xs font-light mt-1">
                {formatUgandaTime(tx.createdAt)}
              </p>
              {tx.method && <p className="text-black text-xs font-light mt-1">Via: {tx.method}</p>}
            </div>
            <p className={`text-sm font-light capitalize ${
              status === 'success'? 'text-green-500' :
              status === 'pending'? 'text-yellow-500' :
              'text-red-400'
            }`}>
              {status || 'unknown'}
            </p>
          </div>
        </div>
      )
    }

    // DAILY INCOME, VIPLEVEL PURCHASE, REFUND, SHARES
    return (
      <div key={tx.id} className="border border-gray-200 rounded p-3 bg-white">
        <div className="flex justify-between items-start">
          <p className="text-black text-sm font-light capitalize">{typeKey}</p>
          <p className="text-black text-base font-light">
            {amount.toLocaleString()}shs
          </p>
        </div>

        <div className="flex justify-end">
          <p className="text-black text-xs font-light mt-1">
            {formatUgandaTime(tx.createdAt)}
          </p>
        </div>

        {typeKey === 'daily income' && tx.bookTitle && (
          <p className="text-black text-xs font-light mt-1">Book: {tx.bookTitle}</p>
        )}
        {typeKey === 'viplevel purchase' && tx.vipLevel && (
          <p className="text-black text-xs font-light mt-1">Level: {tx.vipLevel}</p>
        )}
        {tx.bookId &&!tx.bookTitle && (
          <p className="text-black text-xs font-light mt-1">Book ID: {tx.bookId}</p>
        )}
      </div>
    )
  }

  if (!user) return <div className="p-4 text-black">Loading...</div>

  return (
    <div className="min-h-screen bg-white">
      <div className="p-4">
        <h1 className="text-xl font-bold text-black">Transaction History</h1>
      </div>

      <div className="overflow-x-auto px-2 pb-2">
        <div className="flex gap-2">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap font-light ${
                activeTab === tab
                ? 'bg-sky-400 text-black'
                  : 'bg-sky-200 text-black'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 pt-2">
        {loading? (
          <p className="text-black text-center py-10">Loading...</p>
        ) : filteredTxs.length === 0? (
          <p className="text-gray-500 text-center py-10">No transactions yet</p>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredTxs.map(renderTx)}
          </div>
        )}
      </div>
    </div>
  )
}