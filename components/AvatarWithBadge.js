'use client'
import React from 'react'

export default function AvatarWithBadge({ username, vipLevel = 0, size = 76, avatar }) {
 const level = Number(vipLevel?? 0)

 // Hot colors for STAR badge per VIP level
 const starColors = {
 0: '#A9A9A9', 1: '#00BFFF', 2: '#FFD700', 3: '#9400D3', 4: '#FF1493',
 5: '#FF4500', 6: '#32CD32', 7: '#FF69B4', 8: '#DC143C', 9: '#8A2BE2', 10: '#FF8C00'
 }

 const starColor = starColors[level] || starColors[0]
 const initial = username? username.charAt(0).toUpperCase() : 'U'

 return (
  <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
   <div style={{
    width: size, height: size, borderRadius: '50%',
    background: avatar? `url(${avatar}) center/cover no-repeat` : '#00BFFF',
    border: '3px solid #00BFFF',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.4, fontWeight: '900', color: 'white'
   }}>
    {!avatar && initial}
   </div>

   {/* STAR badge */}
   <div style={{
    position: 'absolute', bottom: -4, left: -4,
    width: size * 0.45, height: size * 0.45,
    filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))', lineHeight: 1, zIndex: 2
   }}>
    <svg width="100%" height="100%" viewBox="0 0 24 24">
     <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      fill={starColor} stroke="#fff" strokeWidth="1" />
    </svg>
   </div>
  </div>
 )
}