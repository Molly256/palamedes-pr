'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AvatarWithBadge from '../../components/AvatarWithBadge'
import Card from '../../components/Card'

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
 <Card>
 <main style={{
 minHeight: 'auto',
 background: '#FFFFFF',
 padding: '15px 20px 0', // changed: removed 80px bottom padding
 boxSizing: 'border-box'
 }}>

 <div style={{ 
 display: 'flex', 
 justifyContent: 'space-between', 
 alignItems: 'flex-start',
 marginBottom: '15px' 
 }}>
 <div>
 <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#00BFFF' }}>
 Welcome to PALAMEDES PR
 </h2>
 <p style={{ margin: '6px 0 0', fontSize: '16px', fontWeight: '800', color: '#000' }}>
 {user?.phone} {user?.nickname || user?.username || 'User'}
 </p>
 </div>
 <AvatarWithBadge username={user?.username} vipLevel={user?.vip || 0} size={60} avatar={user?.avatar || ''} />
 </div>

 <div style={{ 
 background: '#FFFFFF',
 border: '1px solid #E0E0E0',
 borderRadius: '20px',
 padding: '15px',
 marginBottom: '12px',
 boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
 }}>
 <p style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#666' }}>
 Available Balance
 </p>
 <p style={{ margin: '6px 0 0', fontSize: '32px', fontWeight: '900', color: '#000' }}>
 {(user?.balance?.toLocaleString() || 0)} shs
 </p>
 </div>

 <div style={{ 
 display: 'grid', 
 gridTemplateColumns: 'repeat(3, 1fr)', // CHANGED: 3 per row
 gap: '12px', // CHANGED: gap like green boxes
 marginBottom: '20px'
 }}>
 {menuItems.map(item => (
 <Link key={item.label} href={item.href} style={{ textDecoration: 'none' }}>
 <div style={{ textAlign: 'center' }}>
 <div style={{ 
 width: '100%', // CHANGED: full width of grid cell
 height: '95px', // CHANGED: exact height like green boxes
 background: '#00BFFF', 
 borderRadius: '14px',
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 justifyContent: 'center',
 margin: '0 auto 6px',
 fontSize: '28px',
 color: '#000'
 }}>
 {item.icon}
 </div>
 <p style={{ margin: 0, fontSize: '12px', fontWeight: '900', color: '#000', lineHeight: '1.2' }}>
 {item.label}
 </p>
 </div>
 </Link>
 ))}
 </div>
 </main>
 </Card>
 )
}