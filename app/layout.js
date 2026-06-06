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
          paddingBottom: '85px', // space for BottomNav only
          minHeight: 'auto', // NO 100vh - tight to content
          background: '#FFFFFF',
          padding: '0 20px 85px', // 0 top, 20px sides, 85px bottom
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