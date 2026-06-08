'use client'
import { useState, useEffect } from 'react'

export default function InvitePage() {
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)

  const getUserInviteCode = (phone) => {
    const clean = phone.replace(/\D/g, '')
    const last6 = clean.slice(-6)
    return `PM${last6}`
  }

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (userData.phone) {
      const code = getUserInviteCode(userData.phone)
      setInviteCode(code)
    }
  }, [])

  const referralLink = `https://www.palamedes-pr.co.uk/r/${inviteCode}`

  const copyCode = () => {
    navigator.clipboard.writeText(inviteCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareWhatsApp = () => {
    const msg = `Join Palamedes and earn money! Use my invite code: ${inviteCode}\n${referralLink}`
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
  }

  const stepStyle = {
    color: '#00BFFF',
    fontWeight: 'bold',
    fontSize: '18px',
    marginBottom: '4px'
  }

  const numberStyle = {
    color: 'white',
    WebkitTextStroke: '1px #00BFFF',
    fontWeight: 'bold',
    fontSize: '24px',
    lineHeight: '1',
    minWidth: '24px'
  }

  const vipLevels = [
    { level: "VIP 0", deposit: 0, books: 4, rate: 625 },
    { level: "VIP 1", deposit: 80000, books: 4, rate: 625 },
    { level: "VIP 2", deposit: 250000, books: 4, rate: 2000 },
    { level: "VIP 3", deposit: 790000, books: 4, rate: 6500 },
    { level: "VIP 4", deposit: 1000000, books: 5, rate: 7000 },
    { level: "VIP 5", deposit: 1500000, books: 5, rate: 10000 },
    { level: "VIP 6", deposit: 2100000, books: 5, rate: 14000 },
    { level: "VIP 7", deposit: 4000000, books: 5, rate: 28000 },
    { level: "VIP 8", deposit: 4600000, books: 5, rate: 32000 },
    { level: "VIP 9", deposit: 5000000, books: 5, rate: 40000 },
    { level: "VIP 10", deposit: 8000000, books: 5, rate: 60000 },
  ]

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">Invite & Earn</h1>

        <div className="bg-white p-6 rounded-xl shadow mb-8">
          <p className="text-sm text-gray-600 mb-2">Your Invite Code:</p>
          <div className="flex gap-2 mb-4">
            <input
              value={inviteCode}
              readOnly
              className="flex-1 p-3 border rounded-lg font-mono text-lg text-center"
            />
            <button onClick={copyCode} className="px-4 bg-blue-600 text-white rounded-lg">
              {copied? 'Copied!' : 'Copy'}
            </button>
          </div>

          <p className="text-sm text-gray-600 mb-2">Your Link:</p>
          <input
            value={referralLink}
            readOnly
            className="w-full p-3 border rounded-lg text-xs mb-6"
          />

          {/* Step 1 */}
          <div className="flex gap-3 mb-6">
            <span style={numberStyle}>1</span>
            <div>
              <p style={stepStyle}>Share your exclusive link:</p>
              <p className="text-sm text-gray-700">Copy your dedicated recruitment link.</p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-3 mb-6">
            <span style={numberStyle}>2</span>
            <div>
              <p style={stepStyle}>Share with Friends:</p>
              <p className="text-sm text-gray-700">Share the link with your family and friends who are looking for a job.</p>
            </div>
          </div>

          {/* Step 3 + WhatsApp button under Team C */}
          <div className="flex gap-3 mb-8">
            <span style={numberStyle}>3</span>
            <div className="flex-1">
              <p style={stepStyle}>Earn Rewards:</p>
              <p className="text-sm text-gray-700 mb-2">Earn rewards as follows:</p>
              <div className="space-y-2 ml-2 mb-4">
                <p className="text-sm text-gray-700"><b style={{color: '#00BFFF'}}>Team A</b> successful invites get you 5%</p>
                <p className="text-sm text-gray-700"><b style={{color: '#00BFFF'}}>Team B</b> successful invites get you 2%</p>
                <p className="text-sm text-gray-700"><b style={{color: '#00BFFF'}}>Team C</b> successful invites get you 1%</p>
              </div>
              
              <button
                onClick={shareWhatsApp}
                className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold"
              >
                Share on WhatsApp
              </button>
            </div>
          </div>

          {/* VIP TABLE - NO WRAPPER BORDER, TABLE WIDTH AUTO */}
          <div className="mt-8">
            <h2 className="text-xl font-bold text-[#00BFFF] mb-4">VIP Levels & Income</h2>
            <div className="overflow-x-auto">
              <table className="text-sm" style={{borderCollapse: 'collapse', width: 'auto'}}>
                {/* Headers hot skyblue */}
                <thead>
                  <tr style={{backgroundColor: '#00BFFF'}}>
                    <th style={{border: '1px solid black', padding: '12px', textAlign: 'left', fontWeight: '800', color: 'white', whiteSpace: 'nowrap'}}>VIP LEVELS</th>
                    <th style={{border: '1px solid black', padding: '12px', textAlign: 'left', fontWeight: '800', color: 'white', whiteSpace: 'nowrap'}}>DEPOSITS</th>
                    <th style={{border: '1px solid black', padding: '12px', textAlign: 'left', fontWeight: '800', color: 'white', whiteSpace: 'nowrap'}}>NUMBER OF BOOKS PER DAY</th>
                    <th style={{border: '1px solid black', padding: '12px', textAlign: 'left', fontWeight: '800', color: 'white', whiteSpace: 'nowrap'}}>DAILY INCOME</th>
                    <th style={{border: '1px solid black', padding: '12px', textAlign: 'left', fontWeight: '800', color: 'white', whiteSpace: 'nowrap'}}>MONTHLY INCOME</th>
                    <th style={{border: '1px solid black', padding: '12px', textAlign: 'left', fontWeight: '800', color: 'white', whiteSpace: 'nowrap'}}>INCOME PER YEAR</th>
                  </tr>
                </thead>

                <tbody>
                  {vipLevels.map((v, i) => {
                    const daily = v.books * v.rate
                    const monthly = daily * 30
                    const yearly = daily * 365

                    return (
                      <tr key={i}>
                        <td style={{border: '1px solid black', padding: '8px 12px', fontWeight: '600', color: '#111', whiteSpace: 'nowrap'}}>{v.level}</td>
                        <td style={{border: '1px solid black', padding: '8px 12px', color: '#333', whiteSpace: 'nowrap'}}>
                          {v.deposit === 0? "FREE" : v.deposit.toLocaleString() + "shs"}
                        </td>
                        <td style={{border: '1px solid black', padding: '8px 12px', color: '#333', whiteSpace: 'nowrap'}}>{v.books} books @ {v.rate.toLocaleString()}shs</td>
                        <td style={{border: '1px solid black', padding: '8px 12px', color: '#15803d', fontWeight: '600', whiteSpace: 'nowrap'}}>{daily.toLocaleString()}shs</td>
                        <td style={{border: '1px solid black', padding: '8px 12px', color: '#333', whiteSpace: 'nowrap'}}>{monthly.toLocaleString()}shs</td>
                        <td style={{border: '1px solid black', padding: '8px 12px', color: '#333', fontWeight: '600', whiteSpace: 'nowrap'}}>{yearly.toLocaleString()}shs</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-600 mt-2">* VIP 0 is free. Tap to activate and get 4 books immediately.</p>
          </div>
        </div>
      </div>
    </div>
  )
}