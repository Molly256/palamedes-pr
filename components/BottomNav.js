'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function BottomNav() {
  const pathname = usePathname()
  const hideOnRoutes = ['/', '/login', '/register', '/admin']
  if (hideOnRoutes.includes(pathname) || pathname.startsWith('/admin')) {
    return null
  }

  const navItems = [
    { href: '/dashboard', icon: '🏠', label: 'Home', color: '#FFB800' },
    { href: '/books', icon: '📋', label: 'BOOKS', color: '#00D26A' },
    { href: '/hot', icon: '🔥', label: 'Hot', color: '#FF2E2E' },
    { href: '/settings', icon: '⚙️', label: 'Settings', color: '#BF5AF2' },
  ]

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      width: '100%',
      maxWidth: '480px', 
      height: '75px', // <- this is your real height
      background: '#FFFFFF', 
      display: 'flex',
      justifyContent: 'space-around', 
      alignItems: 'center',
      borderTop: '1px solid #F1F5F9', 
      boxShadow: '0 -4px 16px rgba(0,0,0,0.06)', 
      margin: '0 auto', 
      padding: '0 12px 10px 12px', 
      zIndex: 99999, 
      boxSizing: 'border-box',
      gap: '8px' 
    }}>
      {navItems.map(item => {
        const isActive = pathname === item.href || (item.href === '/dashboard' && pathname.startsWith('/dashboard/'))
        return (
          <Link key={item.href} href={item.href} style={{ 
            textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: '4px', flex: 1, height: '56px', borderRadius: '12px', 
            background: isActive ? '#F8FAFC' : 'transparent', transform: isActive ? 'scale(1.03)' : 'scale(1)',
            transition: 'all 0.2s ease-in-out', WebkitTapHighlightColor: 'transparent', boxSizing: 'border-box',
            padding: '4px 0'
          }}>
            <span style={{ fontSize: '22px', lineHeight: '1', filter: isActive ? `drop-shadow(0 2px 6px ${item.color}40)` : 'brightness(0.6) grayscale(0.3)', transition: 'filter 0.2s ease' }}>
              {item.icon}
            </span>
            <span style={{ fontSize: '11px', fontWeight: '900', color: isActive ? item.color : '#8E8E93', letterSpacing: '0.1px', lineHeight: '1', transition: 'color 0.2s ease' }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}