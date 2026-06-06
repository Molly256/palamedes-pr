export default function Card({ children, style = {} }) {
  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: '#FFFFFF', // pure white full page
      padding: 0,
      margin: 0,
      boxSizing: 'border-box',
      ...style
    }}>
      {children}
    </div>
  )
}