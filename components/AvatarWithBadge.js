'use client'
import React from 'react'

export default function AvatarWithBadge({ username, vipLevel = 0, size = 70, avatar }) {
 // Rich hot colors for diamond only
 const hotColors = {
 0: '#A9A9A9', // rich grey
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

 const diamondColor = hotColors[vipLevel] || hotColors[0]
 const initial = username? username.charAt(0).toUpperCase() : 'U'

 return (
 <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>

 {/* Avatar circle - sky blue border */}
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

 {/* Diamond badge - stands alone, NO circle background */}
 <div style={{
 position: 'absolute',
 bottom: -3,
 left: -3,
 fontSize: size * 0.4,
 color: diamondColor,
 filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))',
 lineHeight: 1,
 zIndex: 2
 }}>
 💎
 </div>
 </div>
 )
}