'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const TABS = ['ALL', 'DEPOSIT', 'WITHDRAW', 'DAILY INCOME', 'VIPLEVEL PURCHASE', 'REFUND', 'SHARES']

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
      setAllTxs(data.success? data.transactions : [])
    } catch (err) {
      console.error('Error loading transactions:', err)
      setAllTxs([])
    }
    setLoading(false)
  }

  const filteredTxs = useMemo(() => {
    if (activeTab === 'ALL') return allTxs
    const tabKey = activeTab.toLowerCase()
    return allTxs.filter(tx => toTabKey(tx.type) === tabKey)
  }, [allTxs, activeTab])

  const formatUgandaTime = (timestamp) => {
    const ms = Number(timestamp)
    if (!ms || isNaN(ms)) return ''
    const d = new Date(ms)
    const yy = String(d.getFullYear()).slice(-2)
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    const hh = String(d.getHours()).padStart(2, '0')
    const min = String(d.getMinutes()).padStart(2, '0')
    return `${yy} ${mm} ${dd} ${hh}:${min}`
  }

  const renderTx = (tx) => {
    const typeKey = toTabKey(tx.type)
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

    // DAILY INCOME = type | amount, then date below. No book
    return (
      <div key={tx.id} className="border border-gray-200 rounded p-3 bg-white">
        <div className="flex justify-between items-start">
          <p className="text-black text-sm font-light capitalize">{typeKey}</p>
          <p className="text-black text-base font-light">
            {amount.toLocaleString()}shs
          </p>
        </div>
        <p className="text-black text-xs font-light mt-1 text-right">
          {formatUgandaTime(tx.createdAt)}
        </p>
      </div>
    )
  }

  if (!user) return <div className="p-4 text-black">Loading...</div>

  return (
    <div className="min-h-screen bg-white">
      <div className="p-4">
        <h1 className="text-xl font-bold text-black">Transaction History</h1>
      </div>

      {/* Tabs: arranged, skyblue bg, font-light black text */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg whitespace-nowrap font-light text-black transition-colors
                ${activeTab === tab
               ? 'bg-sky-400' // active = hot sky blue
                  : 'bg-sky-200' // inactive = lighter sky blue
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