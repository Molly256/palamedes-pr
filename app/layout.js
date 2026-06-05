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
      <body>{children}</body>
    </html>
  )
}