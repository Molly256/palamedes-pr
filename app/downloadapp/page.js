'use client'
import { useEffect, useState } from 'react'

export default function DownloadApp() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    // If the browser signal is ready, trigger the automatic install popup
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setDeferredPrompt(null)
    } else {
      // Fallback: If the browser isn't ready yet, trigger the manual browser action menu directly
      alert('To install Palamedes:\n\nTap your browser menu (the 3 dots ⋮ in the top right corner) and click "Install app" or "Add to Home screen".')
    }
  }

  return (
    <main style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '16px' }}>Install Palamedes App</h1>
      <p style={{ fontSize: '16px', color: '#555', marginBottom: '32px' }}>
        Install our official app for faster withdrawals, account checks, and offline support.
      </p>
      
      <div>
        <button 
          onClick={handleInstall}
          style={{
            padding: '16px 48px',
            background: '#00BFFF',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 'bold',
            cursor: 'pointer',
            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
          }}
        >
          Install App
        </button>
      </div>

      {/* Manual Fallback Instruction Guide */}
      <div style={{ marginTop: '40px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '400px', margin: '40px auto', textAlign: 'left' }}>
        <h3 style={{ marginTop: 0, color: '#334155' }}>🤖 Android / Google Chrome Manual Steps:</h3>
        <p style={{ color: '#475569', fontSize: '15px' }}>
          If the button above does not trigger, tap the <strong>three dots (⋮)</strong> in the top-right corner of Chrome, then select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
        </p>
      </div>
    </main>
  )
}