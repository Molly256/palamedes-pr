'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function Transactions() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [allTxs, setAllTxs] = useState([])
  const [activeTab, setActiveTab] = useState('ALL')
  const [loading, setLoading] = useState(true)

  const tabs = ['ALL', 'DEPOSIT', 'WITHDRAW', 'DAILY INCOME', 'VIPLEVEL PURCHASE', 'REFUND', 'SHARES']

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
      const res = await fetch(`/api/transactions?phone=${phone}&t=${Date.now()}`)
      const data = await res.json()

      if (data.success) {
        setAllTxs(data.transactions)
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

  const filteredTxs = activeTab === 'ALL'
   ? allTxs
    : allTxs.filter(tx => tx.type.toUpperCase() === activeTab)

  const formatUgandaTime = (timestamp) => {
    const date = new Date(Number(timestamp))
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
    const isDepositWithdraw = tx.type === 'deposit' || tx.type === 'withdraw'

    if (isDepositWithdraw) {
      return (
        <div key={tx.id} className="border border-gray-200 rounded p-3 bg-white">
          <div className="flex justify-between items-start">

            {/* Left side */}
            <div className="flex flex-col">
              <p className="text-black text-sm font-light capitalize">{tx.type}</p>
              <p className="text-gray-600 text-base font-light mt-1">
                {Number(tx.amount).toLocaleString()}shs
              </p>
              <p className="text-black text-xs font-light mt-1">
                {formatUgandaTime(tx.createdAt)}
              </p>
            </div>

            {/* Right side - status */}
            <p className={`text-sm font-light ${
              tx.status === 'success'? 'text-green-500' :
              tx.status === 'pending'? 'text-yellow-500' :
              'text-red-400'
            }`}>
              {tx.status}
            </p>
          </div>
        </div>
      )
    }

    // For DAILY INCOME, VIPLEVEL PURCHASE, REFUND, SHARES
    return (
      <div key={tx.id} className="border border-gray-200 rounded p-3 bg-white">
        <div className="flex justify-between items-start">

          {/* Left side - header */}
          <p className="text-black text-sm font-light capitalize">{tx.type}</p>

          {/* Right side - amount */}
          <p className="text-black text-base font-light">
            {Number(tx.amount).toLocaleString()}shs
          </p>
        </div>

        {/* Date under amount */}
        <div className="flex justify-end">
          <p className="text-black text-xs font-light mt-1">
            {formatUgandaTime(tx.createdAt)}
          </p>
        </div>

        {/* Extra info */}
        {tx.type === 'daily income' && tx.bookTitle && (
          <p className="text-black text-xs font-light mt-1">Book: {tx.bookTitle}</p>
        )}
        {tx.type === 'viplevel purchase' && tx.vipLevel && (
          <p className="text-black text-xs font-light mt-1">Level: {tx.vipLevel}</p>
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

      {/* Tabs */}
      <div className="overflow-x-auto px-2 pb-2">
        <div className="flex gap-2">
          {tabs.map(tab => (
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

      {/* Transaction List */}
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