'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function MyTeamPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!userData.phone) {
      window.location.href = '/login'
      return
    }

    // Fetches live tracking arrays from our optimized backend endpoint
    fetch(`/api/myteam/total?phone=${userData.phone}`)
     .then(r => r.json())
     .then(res => {
        if (res.success) setData(res)
        setLoading(false)
      })
     .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white text-gray-500 font-medium">Loading network tree...</div>
  if (!data) return null

  // INSERTED: Reusable phone list component
  const PhoneList = ({ list }) => (
    list && list.length > 0? (
      <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-100">
        {list.map(p => (
          <span key={p} className="bg-gray-100 text-gray-700 text-[11px] font-bold px-2 py-1 rounded-full">
            {p}
          </span>
        ))}
      </div>
    ) : (
      <p className="text-[11px] text-gray-400 font-medium mt-3 pt-3 border-t border-gray-100">No members yet</p>
    )
  )

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center mb-6">
          <Link href="/dashboard" className="text-[#00BFFF] font-bold mr-4 text-sm">← Back</Link>
          <h1 className="text-xl font-black text-gray-800">My Team Tree</h1>
        </div>

        {/* Big Total Box - Displays absolute aggregated cash generated altogether */}
        <div className="bg-gradient-to-r from-[#00BFFF] to-blue-600 rounded-2xl shadow-md p-6 mb-6 text-white">
          <p className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1">Total Team Commission</p>
          <p className="text-3xl font-black">
            {Number(data.total).toLocaleString()} shs
          </p>
          <p className="text-xs opacity-75 mt-2 font-medium">
            Combined cash rewards earned from Team A, B, and C networks
          </p>
        </div>

        {/* Breakdown - Tracks ALL registered members based on your explicit requirement */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-xl border-gray-100 p-4 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase">Team A</p>
            <p className="text-xl font-black text-[#00BFFF] my-1">{data.breakdown.teamA}</p>
            <p className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full inline-block">Direct (5%)</p>
            {/* INSERTED: Show A phones */}
            <PhoneList list={data.listA} />
          </div>
          <div className="bg-white rounded-xl border-gray-100 p-4 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase">Team B</p>
            <p className="text-xl font-black text-[#00BFFF] my-1">{data.breakdown.teamB}</p>
            <p className="text-[10px] font-bold bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full inline-block">Indirect (2%)</p>
            {/* INSERTED: Show B phones */}
            <PhoneList list={data.listB} />
          </div>
          <div className="bg-white rounded-xl border-gray-100 p-4 text-center">
            <p className="text-xs font-bold text-gray-400 uppercase">Team C</p>
            <p className="text-xl font-black text-[#00BFFF] my-1">{data.breakdown.teamC}</p>
            <p className="text-[10px] font-bold bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded-full inline-block">Indirect (1%)</p>
            {/* INSERTED: Show C phones */}
            <PhoneList list={data.listC} />
          </div>
        </div>

        {/* Informational Policy Box */}
        <div className="bg-white rounded-xl border-gray-100 p-5">
          <h2 className="text-sm font-black text-gray-800 mb-3">Network Commission Rules</h2>
          <div className="space-y-2.5 text-xs text-gray-600 font-semibold">
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span>Team A: People who registered via your link</span>
              <span className="text-[#00BFFF]">5% Payout</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-gray-50">
              <span>Team B: People invited by Team A members</span>
              <span className="text-[#00BFFF]">2% Payout</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span>Team C: People invited by Team B members</span>
              <span className="text-[#00BFFF]">1% Payout</span>
            </div>
            <div className="pt-3 border-t border-dashed text-[10px] text-gray-400 font-medium">
              * The structures display every user who registers under your tree. Financial commission is processed automatically when downline members purchase a premium VIP level tier.
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}