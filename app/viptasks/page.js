'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AvatarWithBadge from '../../components/AvatarWithBadge'

/**
 * @typedef {Object} User
 * @property {string} username
 * @property {string} phone
 * @property {number} available_balance
 * @property {number} vip
 * @property {number} vipPricePaid
 * @property {boolean} vipLocked
 * @property {number} tasksCompleted
 * @property {string=} nickname
 * @property {string=} avatar
 * @property {any=} bankMTN
 * @property {any=} bankAirtel
 * @property {string=} password
 * @property {string=} vipExpiry
 * @property {number=} tasks_read_today
 */

/**
 * @typedef {Object} Vip
 * @property {number} level
 * @property {string} name
 * @property {number} price
 * @property {number} books
 * @property {number} perBook
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {string=} message
 * @property {User=} user
 */

export default function VipTask() {
  /** @type {[User | null, Function]} */
  const [user, setUser] = useState(null)
  const [showBuyPopup, setShowBuyPopup] = useState(false)
  /** @type {[Vip | null, Function]} */
  const [selectedVip, setSelectedVip] = useState(null)
  const [loading, setLoading] = useState(false)

  /** @type {Vip[]} */
  const vips = [
    { level: 0, name: 'VIP 0.Internship', price: 0, books: 4, perBook: 625 },
    { level: 1, name: 'VIP 1', price: 80000, books: 4, perBook: 625 },
    { level: 2, name: 'VIP 2', price: 250000, books: 4, perBook: 2000 },
    { level: 3, name: 'VIP 3', price: 790000, books: 4, perBook: 6500 },
    { level: 4, name: 'VIP 4', price: 1000000, books: 5, perBook: 7000 },
    { level: 5, name: 'VIP 5', price: 1500000, books: 5, perBook: 10000 },
    { level: 6, name: 'VIP 6', price: 2100000, books: 5, perBook: 14000 },
    { level: 7, name: 'VIP 7', price: 4000000, books: 5, perBook: 28000 },
    { level: 8, name: 'VIP 8', price: 4600000, books: 5, perBook: 32000 },
    { level: 9, name: 'VIP 9', price: 5000000, books: 5, perBook: 40000 },
    { level: 10, name: 'VIP 10', price: 8000000, books: 5, perBook: 60000 },
  ]

  /** @type {Record<number, string>} */
  const hotColors = {
    0: '#E0E0E0', 1: '#00BFFF', 2: '#FFD700', 3: '#FF00FF', 4: '#FF1493',
    5: '#FF4500', 6: '#32CD32', 7: '#FF69B4', 8: '#DC143C', 9: '#9400D3', 10: '#FF8C00'
  }

  useEffect(() => {
    /** @type {User} */
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!userData.phone) return
    userData.vip = Number(userData.vip || 0)
    userData.available_balance = Number(userData.available_balance || 0) // fix here
    if (!userData.tasks_read_today) userData.tasks_read_today = 0
    localStorage.setItem('palamedes_user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  /**
   * @param {Vip} vip
   */
  const handleBuyVip = (vip) => {
    if (!user) return
    if (vip.level <= Number(user.vip)) {
      alert('You already have this VIP or higher')
      return
    }
    setSelectedVip(vip)
    setShowBuyPopup(true)
  }

  const confirmBuy = async () => {
    if (!user ||!selectedVip) return

    const newPrice = selectedVip.price

    if ((user.available_balance || 0) < newPrice) { // fix here
      alert('Insufficient balance. Need full amount to upgrade')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'buyvip',
          phone: user.phone,
          vipLevel: selectedVip.level
        })
      })

      /** @type {ApiResponse} */
      const data = await res.json()

      if (!data.success ||!data.user) {
        alert(data.message || 'Purchase failed')
        setLoading(false)
        return
      }

      // Update UI immediately with POST response
      setUser(data.user)
      localStorage.setItem('palamedes_user', JSON.stringify(data.user))
      setShowBuyPopup(false)
      alert(data.message)

    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  const currentVipLevel = Number(user.vip || 0)

  return (
    <main style={{ minHeight: '100vh', background: '#FFFFFF', padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '30px' }}>
        <Link href="/dashboard" style={{ fontSize: '16px', color: '#00BFFF', fontWeight: '900', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', paddingTop: '8px' }}>
          ← Back
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <AvatarWithBadge
            username={user.username}
            vipLevel={currentVipLevel}
            size={60}
            key={currentVipLevel + '-' + user.available_balance}
          />
          <div style={{ marginTop: '8px', textAlign: 'left' }}>
            <p style={{ margin: 0, fontWeight: '900', color: '#000', fontSize: '15px' }}>
              Balance: {user.available_balance?.toLocaleString() || 0} shs
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: '700', color: '#000' }}>
              {vips[currentVipLevel]?.name || 'VIP 0.Internship'}
            </p>
            {user.vipExpiry && (
              <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#666', fontWeight: '600' }}>
                Expires: {new Date(user.vipExpiry).toLocaleDateString('en-GB')}
              </p>
            )}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px', color: '#000' }}>VIP Levels</h2>

      <div style={{ display: 'grid', gap: '12px', marginBottom: '40px' }}>
        {vips.map(vip => {
          const isCurrent = currentVipLevel === vip.level
          const isOwned = currentVipLevel >= vip.level
          const showBuyButton = vip.level >= 1 && vip.level <= 3 && vip.level > currentVipLevel
          const showLock = vip.level >= 4 && vip.level > currentVipLevel

          return (
            <div key={vip.level} style={{
              background: hotColors[vip.level],
              padding: '18px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', minHeight: '75px', opacity: isOwned? 0.6 : 1
            }}>
              <div style={{ color: '#000' }}>
                <p style={{ margin: 0, fontWeight: '900', fontSize: '16px', color: '#000' }}>{vip.name}</p>
                <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: '800', color: '#000' }}>
                  Daily tasks: {vip.books} books @ {vip.perBook.toLocaleString()}shs
                </p>
                {vip.price > 0 && <p style={{ margin: '4px 0 0', fontWeight: '900', color: '#000' }}>{vip.price.toLocaleString()}shs</p>}
              </div>

              <div>
                {showBuyButton && (
                  <button
                    onClick={() => handleBuyVip(vip)}
                    disabled={loading}
                    style={{
                      padding: '10px 24px', borderRadius: '50px', border: 'none',
                      background: 'white', fontWeight: '900', cursor: loading? 'not-allowed' : 'pointer',
                      color: '#000', opacity: loading? 0.6 : 1
                    }}
                  >
                    BUY
                  </button>
                )}
                {showLock && <div style={{ fontSize: '28px' }}>🔒</div>}
                {isCurrent && <div style={{ fontSize: '24px' }}>✅</div>}
                {isOwned &&!isCurrent && <div style={{ fontSize: '18px', fontWeight: '900', color: '#000' }}>Owned</div>}
              </div>
            </div>
          )
        })}
      </div>

      {showBuyPopup && selectedVip && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'white', padding: '30px', borderRadius: '16px', textAlign: 'center', maxWidth: '320px' }}>
            <h3 style={{ color: '#000', fontWeight: '900' }}>Upgrade to {selectedVip.name}?</h3>
            <p style={{ color: '#000', fontWeight: '700' }}>Pay: {selectedVip.price.toLocaleString()} shs</p>
            <p style={{ color: '#000', fontSize: '12px' }}>Valid for 1 year. Previous VIP refunded on upgrade.</p>
            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setShowBuyPopup(false)}
                disabled={loading}
                style={{ flex: 1, padding: '12px', borderRadius: '50px', border: '2px solid #ccc', background: 'white', fontWeight: '800', color: '#000' }}
              >
                No
              </button>
              <button
                onClick={confirmBuy}
                disabled={loading}
                style={{
                  flex: 1, padding: '12px', borderRadius: '50px', border: 'none',
                  background: 'linear-gradient(135deg, #FF1493 0%, #FF00FF 100%)',
                  color: 'white', fontWeight: '900', opacity: loading? 0.6 : 1
                }}
              >
                {loading? 'Processing...' : 'OK'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}