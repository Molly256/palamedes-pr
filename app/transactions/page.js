'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

const TABS = ['ALL', 'DEPOSIT', 'WITHDRAW', 'DAILY INCOME', 'VIPLEVEL PURCHASE', 'REFUND', 'SHARES', 'COMMISSION']

const TYPE_MAP = {
  'vip': 'viplevel purchase',
  'refund_vip': 'refund',
  'deposit': 'deposit',
  'withdraw': 'withdraw',
  'daily income': 'daily income',
  'shares': 'shares',
  'shares_collected': 'shares', 
  'commission': 'commission',
  'team_a_payout': 'commission',
  'team_b_payout': 'commission',
  'team_c_payout': 'commission',
}

const toTabKey = function(t) {
  return TYPE_MAP[String(t || '').toLowerCase().trim()] || String(t || '').toLowerCase().replace(/_/g, ' ').trim()
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
      setAllTxs(data.success ? data.transactions : [])
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
    if (!date || !time) return createdAt
    const [yyyy, mm, dd] = date.split('-')
    const yy = yyyy.slice(-2)
    return yy + '-' + mm + '-' + dd + ' ' + time
  }

  const renderTx = function(tx) {
    const amount = Number(tx.amount) || 0
    const amountStr = Math.abs(amount).toLocaleString() + ' shs'
    const note = tx.label || 'Transaction'
    const isWithdraw = String(tx.type || '').toLowerCase().trim() === 'withdraw'

    const statusColor = tx.status === 'success'
      ? 'text-green-600'
      : tx.status === 'pending'
        ? 'text-red-600'
        : 'text-gray-500'

    return (
      <div key={tx.id} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
        <div className="flex justify-between items-start">
          <div className="flex flex-col w-full">
            <p className="text-black text-sm font-semibold uppercase tracking-tight">{tx.type || 'Transaction'}</p>
            <p className="text-gray-600 text-xs font-light mt-0.5">{note}</p>
            
            {/* If the transaction object item is a withdrawal layout block, render your exact required user tracking logs context stacked down here */}
            {isWithdraw && (
              <div className="mt-2.5 pt-2.5 border-t border-dashed border-gray-200 flex flex-col gap-1 text-xs text-gray-700 font-normal">
                <p>Requested Phone: <span className="text-black font-semibold ml-1">{tx.phone || user?.phone}</span></p>
                <p>Mobile Money Number: <span className="text-black font-semibold ml-1">{tx.withdrawPhone || tx.phoneNumber}</span></p>
                <p>Holder Name: <span className="text-black font-semibold ml-1">{tx.withdrawName || tx.accountName}</span></p>
                <p>Network Gateway: <span className="text-blue-600 font-semibold ml-1">{tx.method || 'MOBILE MONEY'}</span></p>
              </div>
            )}

            <div className="mt-3 flex justify-between items-center bg-gray-50 p-2 rounded-md">
              <span className="text-gray-500 text-xs font-light">{formatUgDate(tx.createdAt)}</span>
              <span className="text-black text-sm font-bold">{amountStr}</span>
            </div>
          </div>

          <div className="flex flex-col items-end justify-start ml-2">
            <p className={'text-xs font-bold capitalize ' + statusColor}>
              {tx.status || 'pending'}
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
                  type="button"
                  onClick={function() { setActiveTab(tab) }}
                  className={'flex-shrink-0 px-4 py-2 rounded-lg whitespace-nowrap font-light text-black transition-colors ' +
                    (activeTab === tab ? 'bg-[#38bdf8]' : 'bg-[#bae6fd]')}
                >
                  {tab}
                </button>
              )
            })}
          </div>
        </div>

        <div className="px-4 pb-20 space-y-3">
          {loading ? (
            <p className="text-black text-center py-10">Loading...</p>
          ) : filteredTxs.length === 0 ? (
            <p className="text-gray-500 text-center py-10">No transactions yet</p>
          ) : (
            filteredTxs.map(renderTx)
          )}
        </div>
      </div>
    </div>
  )
}