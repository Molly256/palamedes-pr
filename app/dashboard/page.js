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
 { icon: '🎧', label: 'Manager', href: '/manager' }
 ]

 return (
 <Card>
 <main style={{
 minHeight: 'auto',
 background: '#FFFFFF',
 padding: '15px 20px 0',
 boxSizing: 'border-box'
 }}>

 {/* 1 BIG BOX: Welcome + Username + Phone + Balance + Avatar */}
 <div style={{ 
 background: '#FFFFFF',
 border: '1px solid #E0E0E0',
 borderRadius: '20px',
 padding: '20px 15px',
 marginBottom: '25px',
 boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
 position: 'relative',
 minHeight: '140px'
 }}>
 {/* Left side - 4 lines exactly */}
 <div style={{ paddingRight: '90px' }}>
 <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#00BFFF' }}>
 Welcome to PALAMEDES PR
 </h2>
 <p style={{ margin: '8px 0 0', fontSize: '16px', fontWeight: '800', color: '#000' }}>
 Username: {user?.name || user?.nickname || user?.username || 'User'}
 </p>
 <p style={{ margin: '6px 0 0', fontSize: '16px', fontWeight: '800', color: '#000' }}>
 Phone number: {user?.phone || 'Not registered'}
 </p>
 <p style={{ margin: '12px 0 4px', fontSize: '14px', fontWeight: '800', color: '#666' }}>
 Available balance
 </p>
 <p style={{ margin: '0', fontSize: '32px', fontWeight: '900', color: '#000' }}>
 {(user?.balance || 0).toLocaleString()} shs
 </p>
 </div>

 {/* Right side - Avatar top-right, bigger 72px */}
 <div style={{ 
 position: 'absolute', 
 top: '20px', 
 right: '18px'
 }}>
 <AvatarWithBadge username={user?.username} vipLevel={user?.vip || 0} size={72} avatar={user?.avatar || ''} />
 </div>
 </div>

 {/* 9 Buttons - 3x3 with spacing like your green boxes */}
 <div style={{ 
 display: 'grid', 
 gridTemplateColumns: 'repeat(3, 1fr)',
 gap: '18px 15px',
 marginBottom: '60px'
 }}>
 {menuItems.map(item => (
 <Link key={item.label} href={item.href} style={{ textDecoration: 'none' }}>
 <div style={{ textAlign: 'center' }}>
 <div style={{ 
 width: '100%',
 height: '95px',
 background: '#00BFFF', 
 borderRadius: '14px',
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 justifyContent: 'center',
 fontSize: '28px',
 color: '#000'
 }}>
 {item.icon}
 </div>
 <p style={{ margin: '6px 0 0', fontSize: '12px', fontWeight: '900', color: '#000', lineHeight: '1.2' }}>
 {item.label}
 </p>
 </div>
 </Link>
 ))}

 {/* 3 empty boxes on last row like sketch */}
 {[...Array(3)].map((_, i) => (
 <div key={`empty-${i}`} style={{ height: '95px' }}></div>
 ))}
 </div>
 </main>
 </Card>
 )
}