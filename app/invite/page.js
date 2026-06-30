'use client'
import { useState, useEffect } from 'react'

export default function InvitePage() {
  const [user, setUser] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    try {
      const cached = localStorage.getItem('palamedes_user')
      if (cached) {
        const parsedData = JSON.parse(cached)
        if (parsedData && parsedData.user) {
          setUser(parsedData.user)
        } else {
          setUser(parsedData)
        }
      }
    } catch (e) {
      console.error('LocalStorage parsing error:', e)
    }
  }, [])

  const getInviteLink = () => {
    if (!user || !user.inviteCode) return 'Loading your code...'
    return `https://www.palamedes-pr.co.uk/r/${user.inviteCode}` // <- CHANGED: added /r/
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

  const MONTHLY_SALARY_DATA = [
    { team: 'A +BC', people: '50 +50', salary: '1,000,000 shs' },
    { team: 'A +BC', people: '100 +100', salary: '2,000,000 shs' },
    { team: 'A +BC', people: '200 +200', salary: '3,500,000 shs' },
  ]

  const COMMISSIONS = [
    { level: 'Level 1 (Direct)', rate: '5%', desc: 'Your direct team setup' },
    { level: 'Level 2 (Sub)', rate: '2%', desc: 'Invited by Level 1' },
    { level: 'Level 3 (Indirect)', rate: '1%', desc: 'Invited by Level 2' },
  ]

  const tableHeaderStyle = { 
    padding: '5px 3px', 
    fontSize: '10px', 
    fontWeight: '400', 
    background: '#87CEEB', 
    border: '1px solid #000', 
    color: '#000', 
    textAlign: 'center',
    whiteSpace: 'nowrap'
  }

  const tableCellStyle = { 
    padding: '5px 3px', 
    fontSize: '9.5px', 
    fontWeight: '700', 
    border: '1px solid #000', 
    color: '#1E293B', 
    textAlign: 'center',
    whiteSpace: 'nowrap'
  }

  return (
    <div style={{ maxWidth: '480px', margin: '0 auto', padding: '12px', background: '#FFFFFF', boxSizing: 'border-box' }}>
      
      {/* 1. TOP REFERRAL MARKETING INTERFACE PANEL CARD */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.02)', marginBottom: '16px', textAlign: 'center' }}>
        <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: '900', color: '#00BFFF' }}>Invite & Earn Salary</h2>
        <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: '#64748B', fontWeight: '600' }}>Share links below to claim network tier cash directly</p>
        
        <div style={{ background: '#F8FAFC', borderRadius: '12px', padding: '10px', border: '1px dashed #00BFFF', marginBottom: '14px' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#94A3B8', display: 'block', letterSpacing: '1px' }}>MY EXCLUSIVE INVITE CODE</span>
          <span style={{ fontSize: '20px', color: '#00BFFF', fontWeight: '900', letterSpacing: '2px' }}>{user?.inviteCode || '...'}</span>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text" 
            readOnly 
            value={getInviteLink()} 
            style={{ flex: 1, border: '1px solid #E2E8F0', padding: '8px 12px', borderRadius: '10px', fontSize: '11px', color: '#64748B', outline: 'none', background: '#F8FAFC' }}
          />
          <button 
            onClick={handleCopy}
            style={{ padding: '0 16px', background: copied ? '#10B981' : '#00BFFF', border: 'none', color: '#000', fontWeight: '900', borderRadius: '10px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s' }}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      {/* 2. REVENUE DICTIONARY MATRIX TABLE */}
      <h3 style={{ margin: '0 0 8px 4px', fontSize: '13px', fontWeight: '900', color: '#1E293B' }}>💼 VIP Task Salary Rates</h3>
      <div style={{ width: '100%', overflowX: 'hidden', marginBottom: '20px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...tableHeaderStyle, width: '11%' }}>VIP</th>
              <th style={{ ...tableHeaderStyle, width: '15%' }}>Tasks</th>
              <th style={{ ...tableHeaderStyle, width: '14%' }}>Each</th>
              <th style={{ ...tableHeaderStyle, width: '18%' }}>Daily</th>
              <th style={{ ...tableHeaderStyle, width: '21%' }}>Monthly</th>
              <th style={{ ...tableHeaderStyle, width: '21%' }}>Annual</th>
            </tr>
          </thead>
          <tbody>
            {VIPS.map(vip => {
              const daily = vip.perBook * vip.books
              const monthly = daily * 30
              const annual = daily * 365
              return (
                <tr key={vip.level}>
                  <td style={tableCellStyle}>V{vip.level}</td>
                  <td style={tableCellStyle}>{vip.books} bks</td>
                  <td style={tableCellStyle}>{vip.perBook}</td>
                  <td style={{ ...tableCellStyle, color: '#00BFFF' }}>{daily.toLocaleString()}</td>
                  <td style={{ ...tableCellStyle, color: '#10B981' }}>{monthly.toLocaleString()}</td>
                  <td style={{ ...tableCellStyle, color: '#FF4500' }}>{annual.toLocaleString()}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 3. FIXED: ADDED MONTHLY FIXED TEAM SALARY BONUS MATRIX HERE */}
      <h3 style={{ margin: '0 0 8px 4px', fontSize: '13px', fontWeight: '900', color: '#1E293B' }}>💰 MONTHLY SALARY</h3>
      <div style={{ width: '100%', overflowX: 'hidden', marginBottom: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...tableHeaderStyle, width: '30%' }}>Team</th>
              <th style={{ ...tableHeaderStyle, width: '35%' }}>Number of people</th>
              <th style={{ ...tableHeaderStyle, width: '35%' }}>Salary</th>
            </tr>
          </thead>
          <tbody>
            {MONTHLY_SALARY_DATA.map((row, idx) => (
              <tr key={idx}>
                <td style={tableCellStyle}>{row.team}</td>
                <td style={tableCellStyle}>{row.people}</td>
                <td style={{ ...tableCellStyle, color: '#10B981', fontWeight: '900' }}>{row.salary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* 4. TEAM SALARY SYSTEM CONDITIONS DISCLOSURE PANEL */}
      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '10px', marginBottom: '20px' }}>
        <p style={{ margin: '0 0 6px 0', fontSize: '10.5px', color: '#1E293B', fontWeight: '700', lineHeight: '1.4' }}>
          <span style={{ color: '#FF4500', fontWeight: '900' }}>Note:</span> Each employee to qualify for the monthly salary must have only 30% of vip level 1 on his A level.
        </p>
        <p style={{ margin: 0, fontSize: '11px', color: '#00BFFF', fontWeight: '800' }}>
          ℹ️ Salary is paid every month on 10th.
        </p>
      </div>

      {/* 5. AFFILIATE COMMISSIONS TEAMS DOWNLINES BREAKDOWN MATRIX */}
      <h3 style={{ margin: '0 0 8px 4px', fontSize: '13px', fontWeight: '900', color: '#1E293B' }}>👥 Network Share Commission</h3>
      <div style={{ width: '100%', overflowX: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ ...tableHeaderStyle, width: '35%' }}>Generation</th>
              <th style={{ ...tableHeaderStyle, width: '45%' }}>Details</th>
              <th style={{ ...tableHeaderStyle, width: '20%' }}>Rate</th>
            </tr>
          </thead>
          <tbody>
            {COMMISSIONS.map((comm, idx) => (
              <tr key={idx}>
                <td style={{ ...tableCellStyle, textAlign: 'left', fontWeight: '900' }}>{comm.level}</td>
                <td style={{ ...tableCellStyle, textAlign: 'left', color: '#64748B', fontWeight: '500' }}>{comm.desc}</td>
                <td style={{ ...tableCellStyle, color: '#10B981', fontWeight: '900' }}>{comm.rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}