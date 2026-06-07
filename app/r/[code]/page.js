'use client'
import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { isValidInviteCode } from '../../lib/invite'

export default function ReferralRedirect() {
  const params = useParams()
  const router = useRouter()
  const code = params.code

  useEffect(() => {
    // 1. Check if code is valid format
    if (!code || !isValidInviteCode(code)) {
      router.push('/register')
      return
    }

    // 2. Save referrer code in localStorage
    localStorage.setItem('referrer_code', code)

    // 3. Redirect to signup page
    router.push('/register')
  }, [code, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting you to signup...</p>
      </div>
    </div>
  )
}