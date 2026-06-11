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
    if (!deferredPrompt) {
      alert('Install not available.\n\niPhone: Share > Add to Home Screen\nAndroid: Menu > Install app')
      return
    }
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  return (
    <main style={{ padding: '40px 20px', textAlign: 'center' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '16px' }}>Install Palamedes App</h1>
      <p style={{ fontSize: '16px', color: '#555', marginBottom: '24px' }}>
        Install the app for faster access and offline use.
      </p>
      
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
          cursor: 'pointer'
        }}
      >
        Install App
      </button>

      <div style={{ marginTop: '32px', textAlign: 'left', maxWidth: '400px', margin: '32px auto' }}>
        <h3>iPhone:</h3>
        <p>Tap Share → Add to Home Screen</p>
        <h3>Android:</h3>
        <p>Tap Menu → Install app / Add to Home screen</p>
      </div>
    </main>
  )
}