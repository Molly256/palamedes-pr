import './globals.css'
import BottomNav from '../components/BottomNav'
import SWRegister from '../components/SWRegister'

export const metadata = {
  title: 'Palamedes PR',
  description: 'Books Advertising Company',
  icons: { icon: '/favicon.ico' },
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Palamedes' }
}

export const viewport = { themeColor: '#00BFFF' }

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/palamedes-icon-192.png" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body style={{ 
        margin: 0, 
        padding: 0, 
        paddingBottom: '75px', // <- Must match BottomNav height: 75px
        minHeight: '100dvh',   // <- Fixes white screen after login
        background: '#fff',
        boxSizing: 'border-box'
      }}>
        <SWRegister />
        <main style={{ width: '100%', maxWidth: '480px', margin: '0 auto' }}>
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}