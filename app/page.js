'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// 1. Separate component to safely process URL params without crashing Vercel
function SearchParamsTracker() {
  const searchParams = useSearchParams()
  const refCode = searchParams.get('ref')

  useEffect(() => {
    if (refCode) {
      sessionStorage.setItem('activeInviterCode', refCode)
      console.log('Inviter code captured:', refCode)
    }
  }, [refCode])

  return null // Hidden utility logic, does not change your UI layout
}

export default function Home() {
  
  // Directly inject the browser tab icon (favicon) when the page loads
  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']")
    
    if (!link) {
      link = document.createElement('link')
      link.rel = 'icon'
      document.head.appendChild(link) // Fixed targeting crash
    }
    
    link.href = '/palamedes-icon-192.png'
  }, [])

  return (
    <main style={{
      display: 'flex',
      height: '100vh',
      flexDirection: 'column',
      backgroundImage: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(/hero-bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      paddingBottom: '90px'
    }}>
      
      {/* 2. Wrap your search hook component inside a native Suspense container */}
      <Suspense fallback={null}>
        <SearchParamsTracker />
      </Suspense>
      
      <div style={{
        display: 'flex',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '24px',
        padding: '20px'
      }}>
        <Link 
          href="/register"
          style={{
            padding: '18px 56px',
            background: '#00bfff', 
            color: '#ffffff',
            borderRadius: '50px', 
            fontSize: '1.4rem',
            fontWeight: 'bold',
            textDecoration: 'none',
            boxShadow: '0 0 20px rgba(0, 191, 255, 0.6)', 
            transition: 'all 0.2s ease',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          Get Started
        </Link>
      </div>

      <div style={{
        background: 'white',
        padding: '24px 20px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        borderTop: '1px solid #e0e0e0'
      }}>
        <Image 
          src="/bottom-bg.jpg" 
          alt="Awards and Certifications Logo Strip"
          width={900}
          height={80}
          style={{maxWidth: '100%', height: 'auto'}}
          priority
        />
      </div>
    </main>
  )
}