'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
 const pathname = usePathname()

 const navItems = [
 { href: '/dashboard', label: 'Home', emoji: '🏠' },
 { href: '/viptasks', label: 'Tasks', emoji: '📋' },
 { href: '/hot', label: 'Hot', emoji: '🔥' },
 { href: '/my', label: 'My', emoji: '👤' },
 { href: '/settings', label: 'Settings', emoji: '⚙️' }
 ]

 return (
 <nav style={{
 position: 'fixed',
 bottom: 0,
 left: 0,
 right: 0,
 height: '70px',
 background: 'transparent',
 backdropFilter: 'blur(0px)', // colorless
 display: 'flex',
 justifyContent: 'space-around',
 alignItems: 'center',
 zIndex: 9999,
 borderTop: '1px solid rgba(0,0,0,0.05)', // thin line so you can see it
 paddingBottom: 'env(safe-area-inset-bottom)'
 }}>
 {navItems.map(item => {
 const isActive = pathname === item.href
 
 return (
 <Link key={item.href} href={item.href} style={{
 display: 'flex',
 flexDirection: 'column',
 alignItems: 'center',
 justifyContent: 'center',
 textDecoration: 'none',
 flex: 1,
 gap: '3px'
 }}>
 <span style={{ fontSize: '26px', lineHeight: 1 }}>
 {item.emoji}
 </span>
 <span style={{
 fontSize: '11px',
 fontWeight: isActive? '900' : '700',
 color: isActive? '#00BFFF' : '#888'
 }}>
 {item.label}
 </span>
 </Link>
 )
 })}
 </nav>
 )
}