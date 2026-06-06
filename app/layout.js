import BottomNav from '../components/BottomNav'

export const metadata = {
  title: 'Palamedes PR',
  description: 'Books Advertising Company',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ 
        margin: 0, 
        padding: 0, 
        overflowX: 'hidden', 
        background: '#FFFFFF',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <div style={{ 
          paddingBottom: '85px', 
          minHeight: '100vh',
          background: '#FFFFFF',
          padding: '20px',
          boxSizing: 'border-box'
        }}>
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  )
}