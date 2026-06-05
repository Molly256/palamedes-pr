import Link from 'next/link'
import Image from 'next/image'

export default function Home() {
  return (
    <main style={{
      display: 'flex',
      height: '100vh',
      flexDirection: 'column',
      backgroundImage: 'linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(/hero-bg.jpg)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      paddingBottom: '90px' // KEY: space for colorless bottom nav bar
    }}>
      
      {/* Center content */}
      <div style={{
        display: 'flex',
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '24px',
        padding: '20px'
      }}>
        <h1 style={{
          color: 'white',
          fontSize: '48px',
          margin: 0,
          textAlign: 'center',
          textShadow: '2px 2px 12px rgba(0,0,0,0.8)'
        }}>
          Welcome to <span style={{color: 'skyblue', fontWeight: 'bold'}}>PALAMEDES PR COMPANY</span>
        </h1>

        {/* Get Started button → register page */}
        <Link 
          href="/register"
          style={{
            padding: '16px 48px',
            background: 'skyblue',
            color: '#0a0a0a',
            borderRadius: '8px',
            fontSize: '1.2rem',
            fontWeight: 'bold',
            textDecoration: 'none',
            boxShadow: '0 6px 16px rgba(0,0,0,0.4)',
            transition: 'transform 0.2s'
          }}
        >
          Get Started
        </Link>
      </div>

      {/* Bottom logos strip - now sits above nav bar */}
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
          alt="Awards and Certifications"
          width={900}
          height={80}
          style={{maxWidth: '100%', height: 'auto'}}
          priority
        />
      </div>
    </main>
  )
}