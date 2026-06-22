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
    
    fetch(`/api/myteam/total?phone=${userData.phone}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) setData(res)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>
  if (!data) return null

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center mb-6">
          <Link href="/dashboard" className="text-[#00BFFF] font-bold mr-4">← Back</Link>
          <h1 className="text-2xl font-bold">MyTeam</h1>
        </div>

        {/* Big Total Box */}
        <div className="bg-gradient-to-r from-[#00BFFF] to-blue-600 rounded-xl shadow-lg p-6 mb-6 text-white">
          <p className="text-sm opacity-90 mb-2">Total Team Commission</p>
          <p className="text-4xl font-bold">
            {data.total.toLocaleString()}shs
          </p>
          <p className="text-xs opacity-80 mt-2">
            From Team A, B, and C combined
          </p>
        </div>

        {/* Breakdown */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-600">Team A</p>
            <p className="text-2xl font-bold text-[#00BFFF]">{data.breakdown.teamA}</p>
            <p className="text-xs text-gray-500">5%</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-600">Team B</p>
            <p className="text-2xl font-bold text-[#00BFFF]">{data.breakdown.teamB}</p>
            <p className="text-xs text-gray-500">2%</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 text-center">
            <p className="text-xs text-gray-600">Team C</p>
            <p className="text-2xl font-bold text-[#00BFFF]">{data.breakdown.teamC}</p>
            <p className="text-xs text-gray-500">1%</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-bold mb-4">How Commission Works</h2>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>Team A: Direct invites</span>
              <span className="font-semibold">5% of their first VIP amount</span>
            </div>
            <div className="flex justify-between">
              <span>Team B: Invites of Team A</span>
              <span className="font-semibold">2% of their first VIP amount</span>
            </div>
            <div className="flex justify-between">
              <span>Team C: Invites of Team B</span>
              <span className="font-semibold">1% of their first VIP amount</span>
            </div>
            <div className="pt-3 border-t text-xs text-gray-500">
              Only counts users who have bought VIP and haven't been paid out yet
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}