'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const TABS = ['ALL', 'DEPOSIT', 'WITHDRAW', 'DAILY INCOME', 'VIPLEVEL PURCHASE', 'REFUND', 'SHARES']

const TYPE_MAP = {
  'vip': 'viplevel purchase',
  'refund_vip': 'refund',
  'deposit': 'deposit',
  'withdraw': 'withdraw',
  'daily income': 'daily income',
  'shares': 'shares',
}

const toTabKey = function(t) {
  return TYPE_MAP[String(t || '').toLowerCase()] || String(t || '').toLowerCase().replace(/_/g, ' ').trim()
}

export default function Transactions() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [allTxs, setAllTxs] = useState([])
  const [activeTab, setActiveTab] = useState('ALL')
  const [loading, setLoading] = useState(true)

  useEffect(function() {
    const localUser = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!localUser.phone) {
      router.push('/login')
      return
    }
    setUser(localUser)
    loadTransactions(localUser.phone)
  }, [router])

  const loadTransactions = async function(phone) {
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

  const filteredTxs = useMemo(function() {
    if (activeTab === 'ALL') return allTxs
    const tabKey = activeTab.toLowerCase()
    return allTxs.filter(function(tx) { return toTabKey(tx.type) === tabKey })
  }, [allTxs, activeTab])

  const formatUgDate = function(createdAt) {
    if (!createdAt) return ''
    const [date, time] = String(createdAt).split(' ')
    if (!date ||!time) return createdAt
    const [yyyy, mm, dd] = date.split('-')
    const yy = yyyy.slice(-2)
    return yy + '-' + mm + '-' + dd + ' + time // 26-09-04 14:32 Uganda
  }

  const renderTx = function(tx) {
    const amount = Number(tx.amount) || 0
    const amountStr = Math.abs(amount).toLocaleString() + 'shs' // black light weight
    const note = tx.label || 'Transaction'

    const statusColor = tx.status === 'success'
    ? 'text-green-600'
      : tx.status === 'pending'
    ? 'text-red-600'
      : 'text-gray-500'

    return (
      <div key={tx.id} className="border border-gray-200 rounded-lg p-4 bg-white">
        <div className="flex justify-between items-start">

          {/* LEFT: Note -> Amount -> Date */}
          <div className="flex flex-col">
            <p className="text-black text-sm font-light">{note}</p>
            <p className="text-black text-base font-light mt-1">{amountStr}</p>
            <p className="text-gray-500 text-xs font-light mt-1">
              {formatUgDate(tx.createdAt)}
            </p>
          </div>

          {/* RIGHT: Status only */}
          <div className="flex flex-col items-end justify-start">
            <p className={'text-xs font-light capitalize ' + statusColor}>
              {tx.status}
            </p>
          </div>

        </div>
      </div>
    )
  }

  if (!user) return <div className="p-4 text-black">Loading...</div>

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto">
        <div className="p-4">
          <h1 className="text-xl font-semibold text-black">Transaction History</h1>
        </div>

        <div className="px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TABS.map(function(tab) {
              return (
                <button
                  key={tab}
                  onClick={function() { setActiveTab(tab) }}
                  className={'flex-shrink-0 px-4 py-2 rounded-lg whitespace-nowrap font-light text-black ' +
                    (activeTab === tab? 'bg-[#38bdf8]' : 'bg-[#bae6fd]')}
                >
                  {tab}
                </button>
              )
            })}
          </div>
        </div>

        <div className="px-4 pb-20 flex-col gap-3">
          {loading? (
            <p className="text-black text-center py-10">Loading...</p>
          ) : filteredTxs.length === 0? (
            <p className="text-gray-500 text-center py-10">No transactions yet</p>
          ) : (
            filteredTxs.map(renderTx)
          )}
        </div>
      </div>
    </div>
  )
}