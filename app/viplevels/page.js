'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import AvatarWithBadge from '../../components/AvatarWithBadge'

const getTodayDateStrFullYear = () => {
  const d = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Kampala" }));
  const yyyy = String(d.getFullYear());
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const getTodayTimeStrKampala = () => {
  return new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).slice(0,16).replace(',', ' ');
}

const isWeekendUganda = () => {
  const ugandaTimeString = new Date().toLocaleString("en-US", { timeZone: "Africa/Kampala" })
  const ugandaDate = new Date(ugandaTimeString)
  const day = ugandaDate.getDay() // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6
}

const Toast = ({ msg, onClose }) => {
  useEffect(() => {
    const t = setTimeout(onClose, 1500);
    return () => clearTimeout(t);
  }, [onClose]);
  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
      background: '#000', color: '#fff', padding: '14px 22px', borderRadius: '12px',
      fontWeight: '900', fontSize: '15px', zIndex: 2000, boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
    }}>
      {msg}
    </div>
  )
}

export default function VipLevels() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState(null)

  const vips = [
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

  const hotColors = {
    1: '#00BFFF', 2: '#FFD700', 3: '#FF00FF', 4: '#FF1493',
    5: '#FF4500', 6: '#32CD32', 7: '#FF69B4', 8: '#DC143C', 9: '#9400D3', 10: '#FF8C00'
  }

  useEffect(() => {
    const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
    if (!userData.phone) return

    const today = new Date().toISOString().split('T')[0]
    const lastReset = userData.lastResetDate || ''

    if (lastReset !== today) {
      userData.books_read_today = 0
      userData.dailyIncome = 0
      userData.lastResetDate = today
    }

    userData.vip = Number(userData.vip || 0)
    userData.availableBalance = Number(userData.availableBalance || 0)
    userData.vipPricePaid = Number(userData.vipPricePaid || 0)
    userData.dailyIncome = Number(userData.dailyIncome || 0)
    userData.books_read_today = Number(userData.books_read_today || 0)
    userData.unlockedBooks = userData.unlockedBooks || []
    userData.completedBooks = userData.completedBooks || []

    localStorage.setItem('palamedes_user', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const showToast = (msg) => setToast(msg)

  const handleBuyVip = async (vip) => {
    if (!user) return
    if (vip.level <= Number(user.vip)) {
      showToast('You already have this VIP or higher')
      return
    }
    if (vip.level > 3) {
      showToast('VIP 4-10 is locked')
      return
    }

    const currentPricePaid = Number(user.vipPricePaid || 0)
    const upgradeCost = vip.price - currentPricePaid 

    if ((user.availableBalance || 0) < vip.price) {
      showToast('Insufficient Available Balance')
      return
    }

    setLoading(true)
    try {
      const dateStr = getTodayDateStrFullYear();
      const timeStr = getTodayTimeStrKampala();
      const isWeekend = isWeekendUganda(); 

      const res = await fetch('/api/viplevels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: user.phone,
          action: 'BUY_VIP',
          payload: {
            vipLevel: vip.level,
            vipName: vip.name,
            price: vip.price,
            books: vip.books,
            dateStr, 
            timeStr, 
            assignBooks: !isWeekend 
          }
        })
      })

      const data = await res.json()

      if (!data.success || !data.user) {
        showToast(data.message || 'Purchase failed')
        setLoading(false)
        return
      }

      const updatedUser = { ...data.user }
      localStorage.setItem('palamedes_user', JSON.stringify(updatedUser))
      setUser(updatedUser)
      showToast(isWeekend ? 'VIP Buy Successful - Books unlock on Monday' : 'VIP Buy Successful') 

    } catch (err) {
      showToast('Error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  if (!user) return null

  const currentVipLevel = Number(user.vip || 0)

  return (
    <main style={{ minHeight: '100vh', background: '#FFFFFF', padding: '20px' }}>
      {toast && <Toast msg={toast} onClose={() => setToast(null)} />}

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '30px' }}>
        <Link href="/dashboard" style={{ fontSize: '16px', color: '#00BFFF', fontWeight: '900', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', paddingTop: '8px' }}>
          ← Back
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <AvatarWithBadge
            username={user.username}
            vipLevel={currentVipLevel}
            size={60}
            avatar={user?.avatar || ''}
            key={currentVipLevel + '-' + user.availableBalance}
          />
          <div style={{ marginTop: '8px', textAlign: 'left' }}>
            <p style={{ margin: 0, fontWeight: '900', color: '#000', fontSize: '15px' }}>
              Available Balance: {user.availableBalance?.toLocaleString() || 0} shs
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: '700', color: '#000' }}>
              {vips.find(v => v.level === currentVipLevel)?.name || 'No VIP'}
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
          const isLocked = vip.level >= 4
          const canBuy = vip.level > currentVipLevel && !isLocked

          return (
            <div key={vip.level} style={{
              background: hotColors[vip.level],
              padding: '18px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', minHeight: '75px', opacity: isOwned ? 0.6 : 1
            }}>
              <div style={{ color: '#000' }}>
                <p style={{ margin: 0, fontWeight: '900', fontSize: '16px', color: '#000' }}>{vip.name}</p>
                <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: '800', color: '#000' }}>
                  Daily books: {vip.books} books @ {vip.perBook.toLocaleString()}shs
                </p>
                <p style={{ margin: '4px 0 0', fontWeight: '900', color: '#000' }}>{vip.price.toLocaleString()}shs</p>
              </div>

              <div>
                {canBuy && (
                  <button
                    onClick={() => handleBuyVip(vip)}
                    disabled={loading}
                    style={{
                      padding: '10px 24px', borderRadius: '50px', border: 'none',
                      background: 'white', fontWeight: '900', cursor: loading ? 'not-allowed' : 'pointer',
                      color: '#000', opacity: loading ? 0.6 : 1
                    }}
                  >
                    BUY
                  </button>
                )}
                {isLocked && vip.level > currentVipLevel && <div style={{ fontSize: '28px' }}>🔒</div>}
                {isCurrent && <div style={{ fontSize: '24px' }}>✅</div>}
                {isOwned && !isCurrent && <div style={{ fontSize: '18px', fontWeight: '900', color: '#000' }}>Owned</div>}
              </div>
            </div>
          )
        })}
      </div>
    </main>
  )
}