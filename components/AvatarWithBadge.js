'use client'
import React from 'react'

export default function AvatarWithBadge({ username, vipLevel = 0, size = 70, avatar }) {
 // Force vipLevel to number 0-10
 const level = parseInt(vipLevel) || 0

 const hotColors = {
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

 const diamondColor = hotColors[level] || hotColors[0]
 const initial = username? username.charAt(0).toUpperCase() : 'U'

 return (
 <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>

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

 {/* Standalone diamond - rich hot grey for VIP 0 */}
 <div style={{
 position: 'absolute',
 bottom: -4,
 left: -4,
 fontSize: size * 0.42,
 color: diamondColor,
 filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.5))',
 lineHeight: 1,
 zIndex: 2
 }}>
 💎
 </div>
 </div>
 )
}