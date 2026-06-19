'use client'
import Card from '../../components/Card'

export default function ManagerPage() {
  const managers = [
    { name: "Manager 1", phone: "447412283536" },
    { name: "Manager 2", phone: "447441424968" },
    { name: "Manager 3", phone: "447451296569" }
  ]

  const getWaLink = (phone) => `https://wa.me/${phone}?text=Hello%20Manager%20-%20Palamedes%20PR`

  return (
    <Card>
      <main style={{
        minHeight: '100vh',
        background: '#FFFFFF',
        padding: '20px',
        paddingBottom: '96px', // space for BottomNav
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          background: '#FFFFFF',
          border: '1px solid #E0E0E0',
          borderRadius: '20px',
          padding: '30px 20px',
          textAlign: 'center',
          maxWidth: '400px',
          width: '100%',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '15px' }}>🎧</div>
          
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: '900', 
            color: '#00BFFF',
            marginBottom: '12px'
          }}>
            Contact Manager
          </h1>
          
          <p style={{ 
            fontSize: '14px', 
            color: '#666',
            marginBottom: '25px',
            lineHeight: '1.5'
          }}>
            Need help with deposit, withdrawal, or VIP issues? 
            Chat with our manager directly on WhatsApp. 
            We reply within 5 minutes.
          </p>

          {managers.map((mgr, idx) => (
            <button 
              key={mgr.phone}
              onClick={() => window.open(getWaLink(mgr.phone), "_blank")}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                padding: '16px 20px',
                borderRadius: '14px',
                background: '#25D366',
                border: 'none',
                color: 'white',
                fontWeight: '900',
                fontSize: '16px',
                boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                marginBottom: idx < managers.length - 1 ? '12px' : '0'
              }}
              onMouseDown={(e) => {
                e.currentTarget.style.transform = 'scale(0.97)'
                e.currentTarget.style.boxShadow = '0 2px 6px rgba(37, 211, 102, 0.3)'
              }}
              onMouseUp={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 211, 102, 0.3)'
              }}
            >
              👤 Chat with {mgr.name}
            </button>
          ))}

          <div style={{
            marginTop: '20px',
            padding: '12px',
            background: '#f5f5f5',
            borderRadius: '10px',
            fontSize: '12px',
            color: '#666',
            textAlign: 'left'
          }}>
            <div>📱 Manager Maya: +447412283536</div>
            <div>📱 Manager Zoe: +447441424968</div>
            <div>📱 Manager Alicia: +447451296569</div>
          </div>
        </div>
      </main>
    </Card>
  )
}