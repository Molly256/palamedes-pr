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

  useEffect(() => {
    const stored = localStorage.getItem('palamedes_user')
    const userData = JSON.parse(stored || '{}')
    setUser(userData)
    
    if (userData.phone) {
      fetchTeamData(userData.phone)
    } else {
      console.log('No user found - loading test data')
      loadTestData()
    }
  }, [])

  const loadTestData = () => {
    // Fake data for testing UI without login
    setTotalCommission(45000)
    setTeamA([
      {username: 'Alex', phone: '0701111', vipLevel: 3, hasCommission: true},
      {username: 'Sarah', phone: '0702222', vipLevel: 2, hasCommission: true}
    ])
    setTeamB([
      {username: 'Mike', phone: '0703333', vipLevel: 1, hasCommission: false}
    ])
    setTeamC([])
    setLoading(false)
  }

  const fetchTeamData = async (phone) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/myteam?phone=${phone}`)
      const data = await res.json()
      
      if (data.success) {
        setTotalCommission(data.totalCommission || 0)
        setTeamA(data.teamA || [])
        setTeamB(data.teamB || [])
        setTeamC(data.teamC || [])
      } else {
        loadTestData() // fallback if API fails
      }
    } catch (err) {
      console.error('Failed to fetch team:', err)
      loadTestData() // fallback if API fails
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
                <p style={{ margin: 0, fontWeight: '800', color: '#000' }}>{m.username}</p>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#666' }}>
                  {m.phone} • {m.vipLevel > 0 ? `VIP${m.vipLevel}` : 'No VIP'}
                </p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ 
                  margin: 0, 
                  fontSize: '12px', 
                  fontWeight: '800',
                  color: m.hasCommission ? '#00BFFF' : '#999'
                }}>
                  {m.hasCommission ? 'Commission Paid' : 'Pending VIP'}
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

  return (
    <Card>
      <main style={{ minHeight: 'auto', background: '#FFFFFF', padding: '15px 20px' }}>
        
        {/* Back button */}
        <Link href="/dashboard" style={{ textDecoration: 'none', color: '#00BFFF', fontWeight: '800', marginBottom: '15px', display: 'block' }}>
          ← Back to Dashboard
        </Link>

        <h1 style={{ textAlign: 'center', marginBottom: '20px', color: '#000', fontSize: '24px' }}>
          My Team
        </h1>

        {/* Total Commission Box */}
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

        {/* Team A */}
        <TeamSection 
          title="Team A - Direct Invites" 
          members={teamA} 
          color="#00BFFF" 
        />

        {/* Team B */}
        <TeamSection 
          title="Team B - Level 2" 
          members={teamB} 
          color="#FF8C00" 
        />

        {/* Team C */}
        <TeamSection 
          title="Team C - Level 3" 
          members={teamC} 
          color="#32CD32" 
        />

      </main>
    </Card>
  )
}