'use client'
import { useEffect, useState } from 'react'

export default function DownloadApp() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // 📱 Check if the user is holding an iPhone/iPad
    const checkPlatform = () => {
      const userAgent = window.navigator.userAgent.toLowerCase()
      if (/iphone|ipad|ipod/.test(userAgent)) {
        setIsIOS(true)
      }
    }
    checkPlatform()

    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) {
      // Instead of an annoying alert, we let them know we are scrolling to manual guides
      alert('To install manually:\n\nAndroid: Tap browser menu (three dots) > Install app.\niPhone: Tap Share > Add to Home Screen.')
      return
    }
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setDeferredPrompt(null)
  }

  return (
    <main style={{ padding: '40px 20px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '16px' }}>Install Palamedes App</h1>
      <p style={{ fontSize: '16px', color: '#555', marginBottom: '32px' }}>
        Install our official app for faster withdrawals, account checks, and offline support.
      </p>
      
      {/* 🚀 SMART UI: If it is an iPhone, do not show a broken button! Show manual guides first */}
      {isIOS ? (
        <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '12px', marginBottom: '24px', border: '1px solid #bae6fd' }}>
          <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#0369a1', margin: '0 0 10px 0' }}>📱 iPhone / Safari Installation</p>
          <ol style={{ textAlign: 'left', margin: '0 auto', maxWidth: '320px', lineHeight: '1.6' }}>
            <li>Tap the <strong>Share</strong> button (square box with up arrow at the bottom).</li>
            <li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>
          </ol>
        </div>
      ) : (
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
            {deferredPrompt ? '⚡ Install App Now' : 'How to Install'}
          </button>
        </div>
      )}

      {/* Manual Fallback Instruction Guide */}
      {!isIOS && (
        <div style={{ marginTop: '40px', background: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #e2e8f0', maxWidth: '400px', margin: '40px auto text-left', textAlign: 'left' }}>
          <h3 style={{ marginTop: 0, color: '#334155' }}>🤖 Android / Google Chrome Manual Steps:</h3>
          <p style={{ color: '#475569', fontSize: '15px' }}>
            If the button above does not trigger, tap the <strong>three dots (⋮)</strong> in the top-right corner of Chrome, then select <strong>Install app</strong> or <strong>Add to Home screen</strong>.
          </p>
        </div>
      )}
    </main>
  )
}