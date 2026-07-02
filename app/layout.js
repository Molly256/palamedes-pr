'use client'

import './globals.css'
import BottomNav from '../components/BottomNav'
import SWRegister from '../components/SWRegister'
import { usePathname } from 'next/navigation'

export default function RootLayout({ children }) {
  const pathname = usePathname()

  // Define exactly which pages should NOT load the navigation bar components
  const hideNavPages = ['/', '/register', '/login']
  const shouldHideNav = hideNavPages.includes(pathname)

  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/palamedes-icon-192.png" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="shortcut icon" type="image/png" href="/palamedes-icon-192.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#00BFFF" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <title>Palamedes PR</title>
      </head>
      <body style={{ 
        margin: 0, 
        padding: 0, 
        // Only add bottom padding space if the nav bar is actively rendering
        paddingBottom: shouldHideNav ? '0px' : '75px', 
        minHeight: '100dvh',   
        background: '#fff',
        boxSizing: 'border-box'
      }}>
        <SWRegister />
        
        <main style={{ width: '100%', maxWidth: '480px', margin: '0 auto' }}>
          {children}
        </main>
        
        {/* Only renders your navigation layout when a valid session user is logged inside dashboard panels */}
        {!shouldHideNav && <BottomNav />}
      </body>
    </html>
  )
}