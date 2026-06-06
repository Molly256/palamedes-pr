export default function Card({ children, style = {} }) {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: '#0a0a0a', // same as app bg, no white card
      padding: '40px 20px 120px 20px', // 120px bottom for sponsors + bottom nav
      boxSizing: 'border-box',
      ...style
    }}>
      {children}
    </div>
  )
}