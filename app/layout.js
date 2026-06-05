import BottomNav from '../components/BottomNav'

export const metadata = {
  title: 'Palamedes PR',
  description: 'PR & Communications Agency',
  icons: {
    icon: '/favicon.ico',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, paddingBottom: '80px' }}>
        {children}
        <BottomNav />
      </body>
    </html>
  )
}