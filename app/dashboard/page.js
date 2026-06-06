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
 <main style={{
 minHeight: '100vh',
 background: '#FFFFFF',
 padding: '20px',
 paddingBottom: '85px',
 boxSizing: 'border-box'
 }}>

 <Card style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
 <div>
 <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: '#000' }}>
 Welcome, {user?.nickname || user?.username || 'User'}
 </h2>
 <p style={{ margin: '8px 0 0', fontSize: '14px', fontWeight: '800', color: '#000' }}>
 Phone: {user?.phone || '0771234567'}
 </p>
 <p style={{ margin: '12px 0 0', fontSize: '28px', fontWeight: '900', color: '#000' }}>
 {user?.balance?.toLocaleString() || 0} shs
 </p>
 <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: '800', color: '#000' }}>
 Available Balance
 </p>
 </div>
 <AvatarWithBadge username={user?.username} vipLevel={user?.vip || 0} size={70} avatar={user?.avatar || ''} />
 </Card>

 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
 {menuItems.map(item => (
 <Link key={item.label} href={item.href} style={{ textDecoration: 'none' }}>
 <Card style={{ minHeight: '100px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#00BFFF', boxShadow: '0 4px 8px rgba(0,191,255,0.15)' }}>
 <div style={{ fontSize: '32px', marginBottom: '8px' }}>{item.icon}</div>
 <p style={{ margin: 0, fontSize: '13px', fontWeight: '900', color: '#000' }}>
 {item.label}
 </p>
 </Card>
 </Link>
 ))}
 </div>
 </main>
 )
}