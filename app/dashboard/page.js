'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AvatarWithBadge from '../../components/AvatarWithBadge'
import Card from '../../components/Card'
import { useRouter } from 'next/navigation'

export default function Dashboard() {
 const router = useRouter()
 const [user, setUser] = useState(null)
 const [loading, setLoading] = useState(true)
 const [deferredPrompt, setDeferredPrompt] = useState(null)

 const ADMIN_PHONE = '0753520252'

 const loadUser = async () => {
   const localUser = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
   const cleanPhone = localUser.phone ? localUser.phone.replace(/\s+/g, '') : ''
   
   if (!cleanPhone) {
     setUser(localUser)
     setLoading(false)
     return
   }
   
   try {
     const res = await fetch(`/api/user?phone=${cleanPhone}&t=${Date.now()}`)
     const data = await res.json()
     
     if (data.success && data.user) {
       const userData = {
         ...data.user,
         balance: Number(data.user.balance) || 0,
         vip: Number(data.user.vip) || 0
       }
       localStorage.setItem('palamedes_user', JSON.stringify(userData))
       setUser(userData)
     } else {
       setUser(localUser)
     }
   } catch (e) {
     console.log('KV fetch failed:', e)
     setUser(localUser)
   }
   setLoading(false)
 }

 useEffect(() => {
   loadUser()
   window.addEventListener('focus', loadUser)
   return () => window.removeEventListener('focus', loadUser)
 }, [])

 useEffect(() => {
   const handler = (e) => {
     e.preventDefault()
     setDeferredPrompt(e)
   }
   window.addEventListener('beforeinstallprompt', handler)
   return () => window.removeEventListener('beforeinstallprompt', handler)
 }, [])

 const handleInstall = async () => {
   if (!deferredPrompt) {
     alert('Install not available.\niPhone: Share > Add to Home Screen\nAndroid: Menu > Install app')
     return
   }
   deferredPrompt.prompt()
   const { outcome } = await deferredPrompt.userChoice
   if (outcome === 'accepted') setDeferredPrompt(null)
 }

 const menuItems = [
 { icon: '💳', label: 'Deposit', href: '/deposit' },
 { icon: '🏧', label: 'Withdraw', href: '/withdraw' },
 { icon: '💼', label: 'Viptask', href: '/viptasks' },
 { icon: '📜', label: 'Transactions', href: '/transactions' },
 { icon: '👥', label: 'Invite', href: '/invite' },
 { icon: '👨‍👩‍👧', label: 'Myteam', href: '/myteam' },
 { icon: '📖', label: 'About', href: '/about' },
 { icon: '📱', label: 'Download App', onClick: handleInstall, href: '#' },
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
 
 {/* Admin Panel Button - only for admin */}
 {user?.phone === ADMIN_PHONE && (
   <button
     onClick={() => router.push('/admin')}
     style={{
       position: 'absolute',
       top: '16px',
       right: '16px',
       backgroundColor: '#FF69B4',
       color: '#000',
       fontWeight: '300',
       padding: '6px 14px',
       borderRadius: '16px',
       border: 'none',
       cursor: 'pointer',
       fontSize: '13px',
       zIndex: 10,
       boxShadow: '0 2px 6px rgba(255,105,180,0.3)'
     }}
   >
     Admin Panel
   </button>
 )}

 <div style={{ paddingRight: '90px' }}>
 <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: '#00BFFF' }}>
 Welcome to PALAMEDES PR
 </h2>
 <p style={{ margin: '8px 0 0', fontSize: '16px', fontWeight: '800', color: '#000' }}>
 Username: {loading ? 'Loading...' : user?.username || 'User'}
 </p>
 <p style={{ margin: '6px 0 0', fontSize: '16px', fontWeight: '800', color: '#000' }}>
 Phone number: {user?.phone || 'Not registered'}
 </p>
 <p style={{ margin: '12px 0 4px', fontSize: '14px', fontWeight: '800', color: '#000' }}>
 Available balance
 </p>
 <p style={{ margin: '0', fontSize: '32px', fontWeight: '900', color: '#000' }}>
 {loading ? '0' : (user?.balance || 0).toLocaleString()} shs
 </p>
 </div>

 <div style={{ position: 'absolute', top: '20px', right: '18px' }}>
 <AvatarWithBadge username={user?.username} vipLevel={user?.vip || 0} size={72} avatar={user?.avatar || ''} />
 </div>
 </div>

 <div style={{ 
 display: 'grid', 
 gridTemplateColumns: 'repeat(3, 1fr)',
 gap: '18px 15px',
 marginBottom: '60px'
 }}>
 {menuItems.map(item => (
 <Link key={item.label} href={item.href} onClick={item.onClick} style={{ textDecoration: 'none' }}>
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

 {[...Array(3)].map((_, i) => (
 <div key={`empty-${i}`} style={{ height: '95px' }}></div>
 ))}
 </div>
 </main>
 </Card>
 )
}