'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AvatarWithBadge from '../../components/AvatarWithBadge' // 3 dots - file moved to root

export default function VipTask() {
 const [user, setUser] = useState(null)
 const [showBuyPopup, setShowBuyPopup] = useState(false)
 const [selectedVip, setSelectedVip] = useState(null)

 // VIP config
 const vips = [
 { level: 0, name: 'VIP 0.Internship', price: 0, books: 4, perBook: 625, color: '#e0e0e0', badge: '💎' },
 { level: 1, name: 'VIP 1', price: 80000, books: 4, perBook: 625, color: '#87CEEB', badge: '💎' },
 { level: 2, name: 'VIP 2', price: 250000, books: 4, perBook: 2000, color: '#FFFACD', badge: '💎' },
 { level: 3, name: 'VIP 3', price: 790000, books: 4, perBook: 6500, color: '#DDA0DD', badge: '💎' },
 { level: 4, name: 'VIP 4', price: 1000000, books: 5, perBook: 7000, color: '#FFB6C1', badge: '💎' },
 { level: 5, name: 'VIP 5', price: 1500000, books: 5, perBook: 10000, color: '#FFDAB9', badge: '💎' },
 { level: 6, name: 'VIP 6', price: 2100000, books: 5, perBook: 14000, color: '#90EE90', badge: '💎' },
 { level: 7, name: 'VIP 7', price: 4000000, books: 5, perBook: 28000, color: '#FFC0CB', badge: '💎' },
 { level: 8, name: 'VIP 8', price: 4600000, books: 5, perBook: 32000, color: '#CD5C5C', badge: '💎' },
 { level: 9, name: 'VIP 9', price: 5000000, books: 5, perBook: 40000, color: '#D3D3D3', badge: '💎' },
 { level: 10, name: 'VIP 10', price: 8000000, books: 5, perBook: 60000, color: '#DAA520', badge: '💎' },
 ]

 // HOT COLORS for cards
 const hotColors = {
 0: '#E0E0E0',
 1: '#00BFFF',
 2: '#FFD700',
 3: '#FF00FF',
 4: '#FF1493',
 5: '#FF4500',
 6: '#32CD32',
 7: '#FF69B4',
 8: '#DC143C',
 9: '#9400D3',
 10: '#FF8C00'
 }

 useEffect(() => {
 const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
 setUser(userData)

 if (!userData.vip || userData.vip === 0) {
 userData.vip = 0
 localStorage.setItem('palamedes_user', JSON.stringify(userData))
 setUser(userData)
 }
 }, [])

 const handleBuyVip = (vip) => {
 if (vip.level === user.vip) {
 alert('You already have this VIP')
 return
 }
 setSelectedVip(vip)
 setShowBuyPopup(true)
 }

 const confirmBuy = () => {
 const currentBalance = user.balance || 0

 if (currentBalance < selectedVip.price) {
 alert('Insufficient balance')
 setShowBuyPopup(false)
 return
 }

 const prevVip = vips.find(v => v.level === user.vip)
 const newBalance = currentBalance - selectedVip.price + (prevVip? prevVip.price : 0)

 const updatedUser = {
...user,
 vip: selectedVip.level,
 balance: newBalance
 }

 localStorage.setItem('palamedes_user', JSON.stringify(updatedUser))
 setUser(updatedUser)
 setShowBuyPopup(false)
 alert('VIP activated successfully')
 }

 return (
 <main style={{ minHeight: '100vh', background: '#FFFFFF', padding: '20px' }}>

 {/* Top bar: Back arrow HOT BLUE + Avatar with badge LEFT */}
 <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '30px' }}>

 {/* Back arrow on left - HOT BLUE */}
 <Link href="/dashboard" style={{
 fontSize: '16px',
 color: '#00BFFF',
 fontWeight: '900',
 textDecoration: 'none',
 display: 'flex',
 alignItems: 'center',
 gap: '6px'
 }}>
 ← Back to Dashboard
 </Link>

 {/* User avatar with VIP badge - uses reusable component */}
 <div style={{ display: 'flex', alignItems: 'center' }}>
 <AvatarWithBadge 
 username={user?.username} 
 vipLevel={user?.vip || 0} 
 size={60} 
 />
 
 <div style={{ marginLeft: '15px' }}>
 <p style={{ margin: 0, fontWeight: '900', color: '#000' }}>Balance: {user?.balance?.toLocaleString() || 0} shs</p>
 <p style={{ margin: 0, fontSize: '14px', fontWeight: '700', color: '#000' }}>{vips[user?.vip || 0].name}</p>
 </div>
 </div>
 </div>

 <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px', color: '#000' }}>VIP Levels</h2>

 {/* VIP Cards - Hot colors, bold black text */}
 <div style={{ display: 'grid', gap: '12px', marginBottom: '40px' }}>
 {vips.map(vip => {
 const isUnlocked = user?.vip >= vip.level

 return (
 <div key={vip.level} style={{
 background: hotColors[vip.level],
 padding: '18px 20px',
 borderRadius: '12px',
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 minHeight: '75px',
 opacity: vip.level >= 4 &&!isUnlocked? 0.7 : 1
 }}>
 <div style={{ color: '#000' }}>
 <p style={{ margin: 0, fontWeight: '900', fontSize: '16px', color: '#000' }}>
 {vip.name}
 </p>
 <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: '800', color: '#000' }}>
 Daily tasks: {vip.books} books @ {vip.perBook.toLocaleString()}shs
 </p>
 {vip.price > 0 && <p style={{ margin: '4px 0 0', fontWeight: '900', color: '#000' }}>
 {vip.price.toLocaleString()}shs
 </p>}
 </div>

 <div>
 {vip.level >= 1 && vip.level <= 3 && (
 <button
 onClick={() => handleBuyVip(vip)}
 style={{
 padding: '10px 24px',
 borderRadius: '50px',
 border: 'none',
 background: 'white',
 fontWeight: '900',
 cursor: 'pointer',
 color: '#000'
 }}
 >
 BUY
 </button>
 )}

 {vip.level >= 4 && (
 <div style={{ fontSize: '28px' }}>🔒</div>
 )}

 {isUnlocked && vip.level!== user?.vip && vip.level < 4 && (
 <div style={{ fontSize: '24px' }}>✅</div>
 )}
 </div>
 </div>
 )
 })}
 </div>

 {/* Buy Confirmation Popup */}
 {showBuyPopup && (
 <div style={{
 position: 'fixed',
 top: 0,
 left: 0,
 right: 0,
 bottom: 0,
 background: 'rgba(0,0,0,0.7)',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 zIndex: 1000
 }}>
 <div style={{
 background: 'white',
 padding: '30px',
 borderRadius: '16px',
 textAlign: 'center',
 maxWidth: '320px'
 }}>
 <h3 style={{ color: '#000', fontWeight: '900' }}>Do you want to BUY {selectedVip?.name}?</h3>
 <p style={{ color: '#000', fontWeight: '700' }}>Price: {selectedVip?.price.toLocaleString()} shs</p>
 <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
 <button onClick={() => setShowBuyPopup(false)} style={{
 flex: 1,
 padding: '12px',
 borderRadius: '50px',
 border: '2px solid #ccc',
 background: 'white',
 fontWeight: '800',
 color: '#000'
 }}>No</button>
 <button onClick={confirmBuy} style={{
 flex: 1,
 padding: '12px',
 borderRadius: '50px',
 border: 'none',
 background: 'linear-gradient(135deg, #FF1493 0%, #FF00FF 100%)',
 color: 'white',
 fontWeight: '900'
 }}>OK</button>
 </div>
 </div>
 </div>
 )}

 </main>
 )
}