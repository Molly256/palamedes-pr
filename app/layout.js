import BottomNav from '../components/BottomNav'
import SWRegister from '../components/SWRegister'

export const metadata = {
  title: 'Palamedes PR',
  description: 'Books Advertising Company',
  icons: {
    icon: '/favicon.ico',
  },
  manifest: '/manifest.json',
  themeColor: '#00BFFF',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Palamedes'
  }
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
        background: '#FFFFFF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <SWRegister />
        
        <div style={{ 
          paddingBottom: '85px',
          minHeight: 'auto',
          background: '#FFFFFF',
          padding: '0 20px 85px',
          boxSizing: 'border-box',
          width: '100%'
        }}>
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  )
}