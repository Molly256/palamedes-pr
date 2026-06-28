'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function GenerateBooks() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)

  const ADMIN_PHONE = '0753520252'

  const runGenerate = async () => {
    const localUser = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (localUser.phone !== ADMIN_PHONE) {
      router.push('/dashboard')
      return
    }

    if (!confirm('Generate 4 books for ALL VIP users for today? This will overwrite today\'s books.')) return

    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/generate-books', { 
        method: 'GET', // Changed to GET so you can also open URL manually
        cache: 'no-store' 
      })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      setResult({ success: false, message: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <h1 className="text-2xl font-bold text-black mb-6">Generate Books - Today Only</h1>

      <button
        onClick={runGenerate}
        disabled={loading}
        className="px-6 py-3 bg-blue-600 text-white rounded font-bold disabled:opacity-50"
      >
        {loading ? 'Generating...' : 'Generate 4 Books for Today'}
      </button>

      <p className="text-gray-500 text-sm mt-2">
        Or hit manually: <code>/api/admin/generate-books</code>
      </p>

      {result && (
        <div className="mt-6 p-4 bg-gray-50 rounded border">
          <p className="text-black font-bold">{result.success ? 'Success ✅' : 'Failed ❌'}: {result.message}</p>
          {result.date && <p className="text-black text-sm">Date: {result.date}</p>}
          {result.bookIds && (
            <p className="text-black mt-2">Book IDs used: <span className="font-mono">{result.bookIds.join(', ')}</span></p>
          )}
          {result.usersUpdated !== undefined && (
            <p className="text-black">Users updated: {result.usersUpdated}</p>
          )}
        </div>
      )}
    </div>
  )
}