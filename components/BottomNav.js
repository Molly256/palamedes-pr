'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'

export default function BottomNav() {
  const pathname = usePathname()

  // FIXED: Expanded safety array blocks the bar on the Admin panel or deep dynamic auth routes
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
    <>
      {/* FIXED: Ghost spacing block pushes scrollable content up so nothing is covered by the nav bar */}
      <div style={{ height: '85px', width: '100%', clear: 'both' }} />

      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: '50%', // 👈 FIXED: Center alignment anchor for desktop monitor previews
        transform: 'translateX(-50%)', // 👈 FIXED: Perfectly centers the container frame
        width: '100%',
        maxWidth: '480px', // 👈 FIXED: Matches your dashboard width limit exactly
        height: '75px',
        background: '#FFFFFF',
        display: 'flex',
        justifyContent: 'space-around', 
        alignItems: 'center',
        border: 'none',
        borderTop: '1px solid #F1F5F9', // Subtle top separator rule line
        boxShadow: '0 -4px 16px rgba(0,0,0,0.04)', // Elegant upward glow shadow
        margin: '0 auto',
        padding: '0 8px',
        zIndex: 9999,
        boxSizing: 'border-box'
      }}>
        {navItems.map(item => {
          // FIXED: Use path string matching patterns to keep home tab active on child layouts
          const isActive = pathname === item.href || (item.href === '/dashboard' && pathname.startsWith('/dashboard/'))
          
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              style={{ 
                textDecoration: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '5px',
                background: 'transparent',
                padding: '6px 12px',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                transition: 'transform 0.2s ease-in-out',
                WebkitTapHighlightColor: 'transparent' // Kills native mobile tapping box overlay
              }}
            >
              <span style={{ 
                fontSize: '26px',
                lineHeight: '1',
                filter: isActive 
                  ? `drop-shadow(0 4px 8px ${item.color}40)` 
                  : 'brightness(0.6) grayscale(0.3)',
                transition: 'filter 0.2s ease'
              }}>
                {item.icon}
              </span>
              <span style={{ 
                fontSize: '11px',
                fontWeight: '800',
                color: isActive ? item.color : '#8E8E93',
                letterSpacing: '0.2px',
                lineHeight: '1',
                transition: 'color 0.2s ease'
              }}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}