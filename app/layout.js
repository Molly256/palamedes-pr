import './globals.css' // <- ONLY CHANGE: Add this line
import BottomNav from '../components/BottomNav'
import SWRegister from '../components/SWRegister'

export const metadata = {
  title: 'Palamedes PR',
  description: 'Books Advertising Company',
  icons: {
    icon: '/favicon.ico',
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Palamedes'
  }
}

export const viewport = {
  themeColor: '#00BFFF'
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/palamedes-icon-192.png" />
      </head>
      <body style={{ 
        margin: 0, 
        padding: 0, 
        overflowX: 'hidden', 
        background: '#F8FAFC', // Elegant soft gray background for desktop side gutters
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <SWRegister />
        
        {/* FIXED: Center containment framework forces full mobile application rendering on all devices */}
        <div style={{
          maxWidth: '480px',
          margin: '0 auto',
          minHeight: '100vh',
          background: '#FFFFFF', // Pristine base canvas for application content layout 
          position: 'relative',
          boxSizing: 'border-box'
        }}>
          
          {/* FIXED: Removed double padding metrics to align perfectly with the updated BottomNav bar */}
          <div style={{ 
            minHeight: 'auto',
            background: '#FFFFFF',
            padding: '0', 
            boxSizing: 'border-box',
            width: '100%'
          }}>
            {children}
          </div>
          
          <BottomNav />
        </div>
      </body>
    </html>
  )
}