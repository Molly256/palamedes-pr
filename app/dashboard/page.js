'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AvatarWithBadge from '../../components/AvatarWithBadge'

export default function Dashboard() {
 const [user, setUser] = useState(null)

 useEffect(() => {
 const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
 setUser(userData)
 }, [])

 const menuItems = [
 { icon: '💳', label: 'Deposit', href: '/deposit' },
 { icon: '🏧', label: 'Withdraw', href: '/withdraw' },
 { icon: '💼', label: 'Viptask', href: '/viptasks' },
 { icon: '📜', label: 'Transactions', href: '/transactions' },
 { icon: '👥', label: 'Invite', href: '/invite' },
 { icon: '👨‍👩‍👧', label: 'Myteam', href: '/myteam' },
 { icon: '📖', label: 'About', href: '/about' },
 { icon: '⚙️', label: 'Settings', href: '/settings' },
 { icon: '🎧', label: 'Manager - contact', href: '/manager' },
 ]

 return (
 <main style={{ minHeight: '100vh', background: '#FFFFFF', padding: '20px' }}> {/* Hot rich white bg */}

 {/* User details card - hot sky blue border */}
 <div style={{
 background: 'white',
 border: '3px solid #00BFFF', // hot rich sky blue lining
 borderRadius: '16px',
 padding: '20px',
 marginBottom: '25px',
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center'
 }}>
 <div>
 <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#000' }}> {/* Bold black */}
 Welcome, {user?.username || 'User'}
 </h2>
 <p style={{ margin: '8px 0 0', fontSize: '14px', fontWeight: '800', color: '#000' }}> {/* Bold black */}
 Phone: {user?.phone || '0771234567'} {/* Shows exact registered number */}
 </p>
 <p style={{ margin: '12px 0 0', fontSize: '28px', fontWeight: '900', color: '#000' }}> {/* Bold black, not blue */}
 {user?.balance?.toLocaleString() || 0} shs {/* shs at end, not UGX at start */}
 </p>
 <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: '800', color: '#000' }}> {/* Bold black */}
 Available Balance
 </p>
 </div>

 {/* Avatar with badge LEFT side hot color */}
 <AvatarWithBadge 
 username={user?.username} 
 vipLevel={user?.vip || 0} 
 size={70} 
 />
 </div>

 {/* Menu grid - hot sky blue cards */}
 <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
 {menuItems.map(item => (
 <Link key={item.label} href={item.href} style={{ textDecoration: 'none' }}>
 <div style={{
 background: '#00BFFF', // hot rich sky blue card
 borderRadius: '12px',
 padding: '20px 10px',
 textAlign: 'center',
 minHeight: '100px',
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 justifyContent: 'center',
 boxShadow: '0 4px 8px rgba(0,191,255,0.3)'
 }}>
 <div style={{ fontSize: '32px', marginBottom: '8px' }}>{item.icon}</div> {/* Emoji stands out on blue */}
 <p style={{ margin: 0, fontSize: '13px', fontWeight: '900', color: '#000' }}> {/* Bold black text */}
 {item.label}
 </p>
 </div>
 </Link>
 ))}
 </div>
 </main>
 )
}