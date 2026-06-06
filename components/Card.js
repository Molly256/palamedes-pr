export default function Card({ children, style = {} }) {
  return (
    <div style={{
      minHeight: 'auto', // changed from 100vh
      width: '100%',
      background: '#FFFFFF',
      padding: 0,
      margin: 0,
      boxSizing: 'border-box',
      ...style
    }}>
      {children}
    </div>
  )
}