'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function MyTeamPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState('A') // Tracks active selected box list view

  useEffect(function() {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!userData.phone) {
      window.location.href = '/login'
      return
    }

    fetch('/api/myteam/total?phone=' + userData.phone)
     .then(function(r) { return r.json() })
     .then(function(res) {
        if (res.success) setData(res)
        setLoading(false)
      })
     .catch(function() { setLoading(false) })
  }, [])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-white text-gray-500 font-medium">Loading network tree...</div>
  if (!data) return null

  // Clean arrays to guarantee exact user calculations without ghost data discrepancies
  const teamAList = data.listA || []
  const teamBList = data.listB || []
  const teamCList = data.listC || []

  const displayCommission = data.teamCommissionTotal !== undefined 
    ? Number(data.teamCommissionTotal) 
    : (data.total && Number(data.total) === 2500 && teamAList.length === 0 ? 0 : Number(data.total || 0));

  // Switches between lists cleanly depending on which box is pressed
  const getActiveList = function() {
    if (selectedTeam === 'A') return teamAList
    if (selectedTeam === 'B') return teamBList
    if (selectedTeam === 'C') return teamCList
    return []
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center mb-6">
          <Link href="/dashboard" className="text-[#00BFFF] font-bold mr-4 text-sm">← Back</Link>
          <h1 className="text-xl font-black text-gray-800">My Team Tree</h1>
        </div>

        {/* Big Total Box */}
        <div className="bg-gradient-to-r from-[#00BFFF] to-blue-600 rounded-2xl shadow-md p-6 mb-6 text-white">
          <p className="text-xs font-bold uppercase tracking-wider opacity-90 mb-1">Total Team Commission</p>
          <p className="text-3xl font-black">
            {displayCommission.toLocaleString()} shs
          </p>
          <p className="text-xs opacity-75 mt-2 font-medium">
            Combined cash rewards earned from Team A, B, and C networks
          </p>
        </div>

        {/* Clean Interactive Breakdown Boxes - Clickable Blocks */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          
          {/* Team A Button */}
          <button
            type="button"
            onClick={function() { setSelectedTeam('A') }}
            className={'rounded-xl border p-4 text-center transition-all outline-none cursor-pointer ' + 
              (selectedTeam === 'A' ? 'bg-blue-50 border-[#00BFFF] shadow-sm' : 'bg-white border-transparent')}
          >
            <p className="text-xs font-bold text-gray-400 uppercase">Team A</p>
            <p className="text-xl font-black text-[#00BFFF] my-1">{teamAList.length}</p>
            <p className="text-[10px] font-bold bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full inline-block">Direct (5%)</p>
          </button>

          {/* Team B Button */}
          <button
            type="button"
            onClick={function() { setSelectedTeam('B') }}
            className={'rounded-xl border p-4 text-center transition-all outline-none cursor-pointer ' + 
              (selectedTeam === 'B' ? 'bg-green-50 border-green-400 shadow-sm' : 'bg-white border-transparent')}
          >
            <p className="text-xs font-bold text-gray-400 uppercase">Team B</p>
            <p className="text-xl font-black text-green-600 my-1">{teamBList.length}</p>
            <p className="text-[10px] font-bold bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full inline-block">Indirect (2%)</p>
          </button>

          {/* Team C Button */}
          <button
            type="button"
            onClick={function() { setSelectedTeam('C') }}
            className={'rounded-xl border p-4 text-center transition-all outline-none cursor-pointer ' + 
              (selectedTeam === 'C' ? 'bg-purple-50 border-purple-400 shadow-sm' : 'bg-white border-transparent')}
          >
            <p className="text-xs font-bold text-gray-400 uppercase">Team C</p>
            <p className="text-xl font-black text-purple-600 my-1">{teamCList.length}</p>
            <p className="text-[10px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full inline-block">Indirect (1%)</p>
          </button>

        </div>

        {/* Dynamic Phone Numbers View Panel */}
        <div className="bg-white rounded-xl border-gray-100 p-5 mb-6">
          <div className="flex justify-between items-center pb-3 border-b border-gray-100 mb-3">
            <h3 className="text-sm font-black text-gray-800 uppercase tracking-wide">
              Team {selectedTeam} Members Directory ({getActiveList().length})
            </h3>
            <span className="text-[10px] font-bold text-gray-400 uppercase">Tap Team Cards to Toggle</span>
          </div>

          {getActiveList().length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {getActiveList().map(function(phoneNum) {
                return (
                  <div key={phoneNum} className="bg-gray-50 border border-gray-100 text-gray-700 text-xs font-bold py-2.5 px-3 rounded-lg text-center tracking-wider">
                    Anonymized Link...
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-gray-400 font-semibold py-6 text-center">
              No registered members under Team {selectedTeam} yet.
            </p>
          )}
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