'use client'
import { useState, useEffect } from 'react'

export default function InvitePage() {
  const [inviteCode, setInviteCode] = useState('')
  const [copied, setCopied] = useState(false)

  // Code logic now lives inside this file - no more lib/ folder needed
  const getUserInviteCode = (phone) => {
    const clean = phone.replace(/\D/g, '')
    const last6 = clean.slice(-6)
    return `PM${last6}`
  }
  
  const isValidInviteCode = (code) => {
    return /^PM\d{6}$/.test(code)
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
    FontSize: '24px',
    lineHeight: '1',
    minWidth: '24px'
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-center">Invite & Earn</h1>
        
        <div className="bg-white p-6 rounded-xl shadow">
          <p className="text-sm text-gray-600 mb-2">Your Invite Code:</p>
          <div className="flex gap-2 mb-4">
            <input 
              value={inviteCode} 
              readOnly 
              className="flex-1 p-3 border rounded-lg font-mono text-lg text-center"
            />
            <button onClick={copyCode} className="px-4 bg-blue-600 text-white rounded-lg">
              {copied ? 'Copied!' : 'Copy'}
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

          {/* Step 3 */}
          <div className="flex gap-3 mb-4">
            <span style={numberStyle}>3</span>
            <div>
              <p style={stepStyle}>Earn Rewards:</p>
              <p className="text-sm text-gray-700 mb-2">Earn rewards as follows:</p>
              <div className="space-y-2 ml-2">
                <p className="text-sm text-gray-700"><b style={{color: '#00BFFF'}}>Team A</b> successful invites get you 5%</p>
                <p className="text-sm text-gray-700"><b style={{color: '#00BFFF'}}>Team B</b> successful invites get you 2%</p>
                <p className="text-sm text-gray-700"><b style={{color: '#00BFFF'}}>Team C</b> successful invites get you 1%</p>
              </div>
            </div>
          </div>

          <button 
            onClick={shareWhatsApp}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold mt-4"
          >
            Share on WhatsApp
          </button>
        </div>
      </div>
    </div>
  )
}