'use client'
import { useState, useEffect } from 'react'

export default function InvitePage() {
  const [user, setUser] = useState(null)
  const [copied, setCopied] = useState(false)

  // Load cached profile to generate real links
  useEffect(() => {
    try {
      const cached = localStorage.getItem('palamedes_user')
      if (cached) setUser(JSON.parse(cached))
    } catch (e) {
      console.error(e)
    }
  }, [])

  const getInviteLink = () => {
    if (!user || !user.inviteCode) return 'Loading your code...'
    return `${window.location.origin}/r/${user.inviteCode}`
  }

  const handleCopy = async () => {
    if (!user || !user.inviteCode) return
    try {
      await navigator.clipboard.writeText(getInviteLink())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error(err)
    }
  }

  const VIPS = [
    { level: 1, perBook: 625, books: 4 },
    { level: 2, perBook: 2000, books: 4 },
    { level: 3, perBook: 6500, books: 4 },
    { level: 4, perBook: 7000, books: 5 },
    { level: 5, perBook: 10000, books: 5 },
    { level: 6, perBook: 14000, books: 5 },
    { level: 7, perBook: 28000, books: 5 },
    { level: 8, perBook: 32000, books: 5 },
    { level: 9, perBook: 40000, books: 5 },
    { level: 10, perBook: 60000, books: 5 },
  ]

  const COMMISSIONS = [
    { level: 'Level 1 (Direct)', rate: '5%', desc: 'Your direct team setup' },
    { level: 'Level 2 (Sub)', rate: '2%', desc: 'Invited by Level 1' },
    { level: 'Level 3 (Indirect)', rate: '1%', desc: 'Invited by Level 2' },
  ]

  // Micro-styles to block horizontal scrolling and tighten content layout padding
  const tableHeaderStyle = { padding: '6px 4px', fontSize: '11px', fontWeight: '800', background: '#F8FAFC', borderBottom: '2px solid #E2E8F0', color: '#64748B', whiteSpace: 'nowrap' }
  const tableCellStyle = { padding: '6px 4px', fontSize: '11px', fontWeight: '700', borderBottom: '1px solid #F1F5F9', color: '#1E293B', whiteSpace: 'nowrap' }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '12px', background: '#FFFFFF', boxSizing: 'border-box' }}>
      
      {/* 1. TOP REFERRAL MARKETING INTERFACE PANEL CARD */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '16px', textAnimate: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', marginBottom: '16px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '900', color: '#00BFFF' }}>Invite & Earn Salary</h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Share links below to claim network tier cash directly</p>
        
        <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '10px', border: '1px dashed #00BFFF', marginBottom: '14px' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#94A3B8', display: 'block', trackingWidth: '1px' }}>MY EXCLUSIVE INVITE CODE</span>
          <span style={{ fontSize: '20px', fontBlack: '900', color: '#00BFFF', fontWeight: '900', letterSpacing: '2px' }}>{user?.inviteCode || '...'}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            readOnly 
            value={getInviteLink()} 
            style={{ flex: 1, bg: '#F8FAFC', border: '1px solid #E2E8F0', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', color: '#64748B', outline: 'none', background: '#F8FAFC' }}
          />
          <button 
            onClick={handleCopy}
            style={{ padding: '0 16px', background: copied ? '#10B981' : '#00BFFF', border: 'none', color: '#000', fontWeight: '900', borderRadius: '10px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* 2. REVENUE DICTIONARY MATRIX TABLE (COMPRESSED TEXT FOR MOBILE SCREEN FIT) */}
      <h3 style={{ margin: '0 0 8px 4px', fontSize: '13px', fontWeight: '900', color: '#1E293B' }}>💼 VIP Task Salary Rates</h3>
      <div style={{ width: '100%', overflowX: 'hidden', border: '1px solid #E2E8F0', borderRadius: '12px', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>VIP Level</th>
              <th style={tableHeaderStyle}>Tasks</th>
              <th style={tableHeaderStyle}>Per Task</th>
              <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Daily Total</th>
            </tr>
          </thead>
          <tbody>
            {VIPS.map(vip => (
              <tr key={vip.level} style={{ backgroundColor: vip.level % 2 === 0 ? '#F8FAFC' : '#FFFFFF' }}>
                <td style={tableCellStyle}>VIP {vip.level}</td>
                <td style={tableCellStyle}>{vip.books} bks</td>
                <td style={tableCellStyle}>{vip.perBook.toLocaleString()}</td>
                <td style={{ ...tableCellStyle, textAlign: 'right', color: '#00BFFF', fontWeight: '900' }}>{(vip.perBook * vip.books).toLocaleString()} shs</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 3. AFFILIATE COMMISSIONS TEAMS DOWNLINES BREAKDOWN MATRIX */}
      <h3 style={{ margin: '0 0 8px 4px', fontSize: '13px', fontWeight: '900', color: '#1E293B' }}>👥 Network Share Commission</h3>
      <div style={{ width: '100%', overflowX: 'hidden', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>Team Generation</th>
              <th style={tableHeaderStyle}>Details</th>
              <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>Bonus Rate</th>
            </tr>
          </thead>
          <tbody>
            {COMMISSIONS.map((comm, idx) => (
              <tr key={idx} style={{ backgroundColor: idx % 2 === 1 ? '#F8FAFC' : '#FFFFFF' }}>
                <td style={{ ...tableCellStyle, fontWeight: '900' }}>{comm.level}</td>
                <td style={{ ...tableCellStyle, color: '#64748B', fontWeight: '500' }}>{comm.desc}</td>
                <td style={{ ...tableCellStyle, textAlign: 'right', color: '#10B981', fontWeight: '900', fontSize: '12px' }}>{comm.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}