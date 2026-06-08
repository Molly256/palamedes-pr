'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import AvatarWithBadge from '../../components/AvatarWithBadge'

export default function VipTask() {
 const [user, setUser] = useState(null)
 const [showBuyPopup, setShowBuyPopup] = useState(false)
 const [selectedVip, setSelectedVip] = useState(null)

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

 const hotColors = {
 0: '#E0E0E0', 1: '#00BFFF', 2: '#FFD700', 3: '#FF00FF', 4: '#FF1493',
 5: '#FF4500', 6: '#32CD32', 7: '#FF69B4', 8: '#DC143C', 9: '#9400D3', 10: '#FF8C00'
 }

 const COMMISSION = { 1:4000, 2:12500, 3:39500, 4:50000, 5:75000, 6:105000, 7:200000, 8:230000, 9:250000, 10:400000 }

 const isWeekend = () => {
 const day = new Date().getDay()
 return day === 0 || day === 6
 }

 useEffect(() => {
 const userData = JSON.parse(localStorage.getItem('palamedes_user') || '{}')
 if (userData.vip === undefined || userData.vip === null) userData.vip = 0
 if (!userData.tasks_read_today) userData.tasks_read_today = 0
 localStorage.setItem('palamedes_user', JSON.stringify(userData))
 setUser(userData)
 }, [])

 const handleBuyVip = (vip) => {
 if (!user) return
 if (vip.level <= user.vip) {
 alert('You already have this VIP or higher')
 return
 }
 setSelectedVip(vip)
 setShowBuyPopup(true)
 }

 const confirmBuy = () => {
 if (!user ||!selectedVip) return

 const newPrice = selectedVip.price
 const prevPrice = vips[user.vip].price

 if ((user.balance || 0) < newPrice) {
 alert('Insufficient balance. Need full amount to upgrade')
 return
 }

 const all = JSON.parse(localStorage.getItem('palamedes_all_users') || '[]')
 const userIndex = all.findIndex(u => u.phone === user.phone)
 if (userIndex === -1) return alert('User not found')

 all[userIndex].balance = user.balance - newPrice
 all[userIndex].vip = selectedVip.level
 all[userIndex].balance = all[userIndex].balance + prevPrice

 let resetTasks = false
 if ((user.tasks_read_today || 0) === 0 &&!isWeekend()) {
 resetTasks = true
 all[userIndex].tasks_read_today = 0
 }

 if (user.vip === 0 && user.referrer_phone) {
 const inviterIndex = all.findIndex(u => u.phone === user.referrer_phone)
 if (inviterIndex!== -1) {
 all[inviterIndex].balance = (all[inviterIndex].balance || 0) + COMMISSION[selectedVip.level]
 }
 }

 localStorage.setItem('palamedes_all_users', JSON.stringify(all))
 localStorage.setItem('palamedes_user', JSON.stringify(all[userIndex]))
 setUser(all[userIndex])
 setShowBuyPopup(false)
 alert('VIP upgraded successfully')
 }

 if (!user) return null

 return (
 <main style={{ minHeight: '100vh', background: '#FFFFFF', padding: '20px' }}>
 <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '30px' }}>
 <Link href="/dashboard" style={{ fontSize: '16px', color: '#00BFFF', fontWeight: '900', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', paddingTop: '8px' }}>← Back</Link>
 <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
 <AvatarWithBadge username={user.username} vipLevel={Number(user.vip || 0)} size={60} key={user.vip || 0} />
 <div style={{ marginTop: '8px', textAlign: 'left' }}>
 <p style={{ margin: 0, fontWeight: '900', color: '#000', fontSize: '15px' }}>Balance: {user.balance?.toLocaleString() || 0} shs</p>
 <p style={{ margin: '2px 0 0', fontSize: '13px', fontWeight: '700', color: '#000' }}>{vips[user.vip || 0].name}</p>
 </div>
 </div>
 </div>

 <h2 style={{ fontSize: '24px', fontWeight: '900', marginBottom: '20px', color: '#000' }}>VIP Levels</h2>

 <div style={{ display: 'grid', gap: '12px', marginBottom: '40px' }}>
 {vips.map(vip => {
 const isCurrent = user.vip === vip.level

 return (
 <div key={vip.level} style={{
 background: hotColors[vip.level],
 padding: '18px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between',
 alignItems: 'center', minHeight: '75px', opacity: vip.level > user.vip + 1? 0.6 : 1
 }}>
 <div style={{ color: '#000' }}>
 <p style={{ margin: 0, fontWeight: '900', fontSize: '16px', color: '#000' }}>{vip.name}</p>
 <p style={{ margin: '4px 0 0', fontSize: '13px', fontWeight: '800', color: '#000' }}>
 Daily tasks: {vip.books} books @ {vip.perBook.toLocaleString()}shs
 </p>
 {vip.price > 0 && <p style={{ margin: '4px 0 0', fontWeight: '900', color: '#000' }}>{vip.price.toLocaleString()}shs</p>}
 </div>

 <div>
 {vip.level > user.vip && vip.level <= 3 && (
 <button onClick={() => handleBuyVip(vip)} style={{
 padding: '10px 24px', borderRadius: '50px', border: 'none',
 background: 'white', fontWeight: '900', cursor: 'pointer', color: '#000'
 }}>BUY</button>
 )}
 {vip.level > user.vip + 1 && vip.level > 3 && <div style={{ fontSize: '28px' }}>🔒</div>}
 {isCurrent && <div style={{ fontSize: '24px' }}>✅</div>}
 </div>
 </div>
 )
 })}
 </div>

 {showBuyPopup && (
 <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
 <div style={{ background: 'white', padding: '30px', borderRadius: '16px', textAlign: 'center', maxWidth: '320px' }}>
 <h3 style={{ color: '#000', fontWeight: '900' }}>Upgrade to {selectedVip?.name}?</h3>
 <p style={{ color: '#000', fontWeight: '700' }}>Pay: {selectedVip?.price.toLocaleString()} shs</p>
 <p style={{ color: '#000', fontSize: '12px' }}>Previous VIP price will be refunded after upgrade</p>
 <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
 <button onClick={() => setShowBuyPopup(false)} style={{ flex: 1, padding: '12px', borderRadius: '50px', border: '2px solid #ccc', background: 'white', fontWeight: '800', color: '#000' }}>No</button>
 <button onClick={confirmBuy} style={{ flex: 1, padding: '12px', borderRadius: '50px', border: 'none', background: 'linear-gradient(135deg, #FF1493 0%, #FF00FF 100%)', color: 'white', fontWeight: '900' }}>OK</button>
 </div>
 </div>
 </div>
 )}
 </main>
 )
}