'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Card from '../../components/Card'

export default function Myteam() {
  const [user, setUser] = useState(null)
  const [totalCommission, setTotalCommission] = useState(0)
  const [teamA, setTeamA] = useState([])
  const [teamB, setTeamB] = useState([])
  const [teamC, setTeamC] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('palamedes_user')
    const userData = JSON.parse(stored || '{}')
    setUser(userData)
    
    if (userData.phone) {
      fetchTeamData(userData.phone)
    } else {
      setError('Not logged in')
      setLoading(false)
    }
  }, [])

  const fetchTeamData = async (phone) => {
    setLoading(true)
    setError(null)
    try {
      // Call the correct endpoint
      const res = await fetch(`/api/user?action=getTeam&phone=${phone}`)
      const data = await res.json()
      
      if (data.success) {
        setTeamA(data.teamA || [])
        setTeamB(data.teamB || [])
        setTeamC(data.teamC || [])
        
        // Get total commission from transactions
        const txRes = await fetch(`/api/user?action=getTransactions&phone=${phone}`)
        const txData = await txRes.json()
        
        if (txData.success) {
          const commission = txData.transactions
            .filter(tx => tx.type === 'referral_reward' && tx.status === 'success')
            .reduce((sum, tx) => sum + Number(tx.amount || 0), 0)
          setTotalCommission(commission)
        }
      } else {
        setError(data.message || 'Failed to load team')
        setTeamA([])
        setTeamB([])
        setTeamC([])
        setTotalCommission(0)
      }
    } catch (err) {
      console.error('Failed to fetch team:', err)
      setError('Network error. Try again.')
      setTeamA([])
      setTeamB([])
      setTeamC([])
      setTotalCommission(0)
    }
    setLoading(false)
  }

  const TeamSection = ({ title, members, color }) => (
    <div style={{ 
      background: '#FFFFFF',
      border: '1px solid #E0E0E0',
      borderRadius: '16px',
      padding: '15px',
      marginBottom: '20px'
    }}>
      <h3 style={{ 
        margin: '0 0 12px 0', 
        fontSize: '18px', 
        fontWeight: '900', 
        color: color 
      }}>
        {title} - {members.length} members
      </h3>
      
      {members.length === 0 ? (
        <p style={{ color: '#999', textAlign: 'center', padding: '20px 0' }}>
          No members yet
        </p>
      ) : (
        <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
          {members.map((m, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: i < members.length - 1 ? '1px solid #F0F0F0' : 'none'
            }}>
              <div>
                <p style={{ margin: 0, fontWeight: '800', color: '#000' }}>
                  {m.nickname || m.username || 'User'}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>
                  {m.phone} • {m.vip > 0 ? `VIP${m.vip}` : 'No VIP'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ 
                  margin: 0, 
                  fontSize: '12px', 
                  fontWeight: '800',
                  color: m.vip > 0 ? '#00BFFF' : '#999'
                }}>
                  {m.vip > 0 ? 'Commission Paid' : 'Pending VIP'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  if (loading) {
    return <Card><p style={{ textAlign: 'center', padding: '50px' }}>Loading team...</p></Card>
  }

  if (error) {
    return <Card><p style={{ textAlign: 'center', padding: '50px', color: 'red' }}>{error}</p></Card>
  }

  return (
    <Card>
      <main style={{ minHeight: 'auto', background: '#FFFFFF', padding: '15px 20px' }}>
        
        <Link href="/dashboard" style={{ textDecoration: 'none', color: '#00BFFF', fontWeight: '800', marginBottom: '15px', display: 'block' }}>
          ← Back to Dashboard
        </Link>

        <h1 style={{ textAlign: 'center', marginBottom: '20px', color: '#000', fontSize: '24px' }}>
          My Team
        </h1>

        <p style={{ textAlign: 'center', margin: '0 0 8px 0', fontSize: '16px', fontWeight: '800', color: '#666' }}>
          Total Commission
        </p>
        <div style={{
          background: '#00BFFF',
          borderRadius: '20px',
          padding: '25px 15px',
          marginBottom: '30px',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,191,255,0.3)'
        }}>
          <p style={{ 
            margin: 0, 
            fontSize: '42px', 
            fontWeight: '900', 
            color: '#000'
          }}>
            {totalCommission.toLocaleString()} shs
          </p>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#000', fontWeight: '800' }}>
            Earned from Team A/B/C
          </p>
        </div>

        <TeamSection 
          title="Team A - Direct Invites" 
          members={teamA} 
          color="#00BFFF" 
        />

        <TeamSection 
          title="Team B - Level 2" 
          members={teamB} 
          color="#FF8C00" 
        />

        <TeamSection 
          title="Team C - Level 3" 
          members={teamC} 
          color="#32CD32" 
        />

      </main>
    </Card>
  )
}