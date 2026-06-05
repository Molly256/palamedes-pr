'use client'

const hotColors = {
 0: '#E0E0E0', // VIP 0 - Gray
 1: '#00BFFF', // VIP 1 - Hot blue
 2: '#FFD700', // VIP 2 - Hot gold
 3: '#FF00FF', // VIP 3 - Hot magenta
 4: '#FF1493', // VIP 4 - Hot pink
 5: '#FF4500', // VIP 5 - Hot orange red
 6: '#32CD32', // VIP 6 - Hot lime green
 7: '#FF69B4', // VIP 7 - Hot pink
 8: '#DC143C', // VIP 8 - Hot crimson
 9: '#9400D3', // VIP 9 - Hot violet
 10: '#FF8C00' // VIP 10 - Hot dark orange
}

export default function AvatarWithBadge({ username, vipLevel = 0, size = 60, avatar }) {
 const badgeColor = hotColors[vipLevel] || hotColors[0]

 return (
 <div style={{ position: 'relative', width: size, height: size }}>
 {/* Avatar circle with image support */}
 <div style={{
 width: size,
 height: size,
 borderRadius: '50%',
 background: avatar? `url(${avatar}) center/cover no-repeat` : '#87CEEB',
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 fontSize: size * 0.4,
 color: 'white',
 fontWeight: '900',
 border: '3px solid #00BFFF' // Hot sky blue border for avatar
 }}>
 {!avatar && username?.[0]?.toUpperCase() || 'U'}
 </div>

 {/* Badge fixed to LEFT side - auto hot color */}
 <div style={{
 position: 'absolute',
 left: '-5px',
 bottom: '-5px',
 background: badgeColor,
 borderRadius: '50%',
 width: size * 0.45,
 height: size * 0.45,
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'center',
 fontSize: size * 0.23,
 border: '3px solid white',
 boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
 zIndex: 2
 }}>
 💎
 </div>
 </div>
 )
}