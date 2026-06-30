'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ReferralRedirect() {
  const params = useParams()
  const router = useRouter()
  const code = params.code
  const [status, setStatus] = useState('validating')

  const isValidInviteCode = (code) => {
    return /^PM\d{6}$/.test(code)
  }

  useEffect(() => {
    if (!code) {
      router.push('/register')
      return
    }

    if (!isValidInviteCode(code)) {
      setStatus('invalid')
      setTimeout(() => router.push('/register'), 1500)
      return
    }

    // Save inviter code for Register page to read
    try {
      localStorage.setItem('referrer_code', code) // <- Sara's PM530252
      sessionStorage.setItem('referrer_code', code) // Safari backup
      setStatus('success')
      
      setTimeout(() => router.push('/register'), 300) // Only redirect here
    } catch (err) {
      console.error('Storage failed:', err)
      router.push('/register')
    }
  }, [code, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        {status === 'validating' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Checking invite code...</p>
          </>
        )}
        
        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-gray-600">Invite code applied! Redirecting...</p>
          </>
        )}
        
        {status === 'invalid' && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-gray-600">Invalid invite code. Redirecting to signup...</p>
          </>
        )}
      </div>
    </div>
  )
}