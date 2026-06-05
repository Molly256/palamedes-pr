'use client'
import React from 'react'

export default function AvatarWithBadge({ username, vipLevel = 0, size = 70, avatar }) {
 // Force to number 0-10
 const level = Number(vipLevel?? 0)

 // Rich hot colors for STAR badge per VIP level
 const starColors = {
 0: '#A9A9A9', // rich hot grey
 1: '#00BFFF', // hot skyblue
 2: '#FFD700', // hot gold
 3: '#9400D3', // hot violet
 4: '#FF1493', // hot deep pink
 5: '#FF4500', // hot orange red
 6: '#32CD32', // hot lime green
 7: '#FF69B4', // hot pink
 8: '#DC143C', // hot crimson
 9: '#8A2BE2', // hot blue violet
 10: '#FF8C00' // hot dark orange
 }

 const starColor = starColors[level] || starColors[0]
 const initial = username? username.charAt(0).toUpperCase() : 'U'

 return (
 <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>

 {/* Avatar circle with sky blue border */}
 <div style={{
 width: size,
 height: size,
 borderRadius: '50%',
 background: avatar? `url(${avatar}) center/cover no-repeat` : '#00BFFF',
 border: '3px solid #00BFFF',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 fontSize: size * 0.4,
 fontWeight: '900',
 color: 'white'
 }}>
 {!avatar && initial}
 </div>

 {/* Standalone STAR badge - colored SVG, NO circle background */}
 <div style={{
 position: 'absolute',
 bottom: -4,
 left: -4,
 width: size * 0.42,
 height: size * 0.42,
 filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))',
 lineHeight: 1,
 zIndex: 2
 }}>
 <svg
 width="100%"
 height="100%"
 viewBox="0 0 24 24"
 >
 <path
 d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
 fill={starColor}
 stroke="#fff"
 strokeWidth="1"
 />
 </svg>
 </div>
 </div>
 )
}