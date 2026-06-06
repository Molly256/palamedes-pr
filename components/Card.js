export default function Card({ children, style = {} }) {
  return (
    <div style={{
      background: '#FFFFFF',
      border: 'none', // ← no border
      borderRadius: '16px',
      padding: '20px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)', // super light shadow so card floats
      boxSizing: 'border-box',
      width: '100%',
      ...style
    }}>
      {children}
    </div>
  )
}