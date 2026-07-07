'use client'
import { useEffect } from 'react'

export default function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(registrations => {
        for(let registration of registrations) {
          registration.unregister()
        }
      })
    }
  }, [])
  return null
}