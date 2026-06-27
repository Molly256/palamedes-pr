'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function BottomNav() {
  const pathname = usePathname()

  const hideOnRoutes = ['/', '/login', '/register']
  if (hideOnRoutes.includes(pathname)) {
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
      height: '75px',
      background: '#FFFFFF',
      display: 'flex',
      justifyContent: 'space-around', // <- keeps 4 tabs evenly spaced
      alignItems: 'center',
      border: 'none',
      borderTop: 'none',
      boxShadow: 'none',
      WebkitBoxShadow: 'none',
      outline: 'none',
      margin: 0,
      padding: 0,
      zIndex: 9999
    }}>
      {navItems.map(item => {
        const isActive = pathname === item.href
        return (
          <Link 
            key={item.href} 
            href={item.href} 
            style={{ 
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              background: 'transparent',
              padding: '8px 10px',
              transform: isActive ? 'scale(1.12)' : 'scale(1)',
              transition: 'transform 0.2s'
            }}
          >
            <span style={{ 
              fontSize: '28px',
              lineHeight: '1',
              filter: isActive 
                ? `brightness(1.3) drop-shadow(0 4px 12px ${item.color}60)` 
                : 'brightness(0.7) saturate(0.8)'
            }}>
              {item.icon}
            </span>
            <span style={{ 
              fontSize: '11px',
              fontWeight: '800',
              color: isActive ? item.color : '#A0A0A0',
              letterSpacing: '0.3px',
              lineHeight: '1'
            }}>
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}