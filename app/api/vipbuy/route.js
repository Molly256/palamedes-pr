import { kv } from '@vercel/kv'

const VIP_CONFIG = {
 0: { price: 0, books: 4, perBook: 625 },
 1: { price: 80000, books: 4, perBook: 625 },
 2: { price: 250000, books: 4, perBook: 2000 },
 3: { price: 790000, books: 4, perBook: 6500 },
 4: { price: 1000000, books: 5, perBook: 7000 },
 5: { price: 1500000, books: 5, perBook: 10000 },
 6: { price: 2100000, books: 5, perBook: 14000 },
 7: { price: 4000000, books: 5, perBook: 28000 },
 8: { price: 4600000, books: 5, perBook: 32000 },
 9: { price: 5000000, books: 5, perBook: 40000 },
 10: { price: 8000000, books: 5, perBook: 60000 },
}

const COMMISSION = { 1:4000, 2:12500, 3:39500, 4:50000, 5:75000, 6:105000, 7:200000, 8:230000, 9:250000, 10:400000 }

function getKampalaTime() {
  return new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Kampala',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

function getKampalaISO() {
  return new Date().toLocaleString('en-CA', {
    timeZone: 'Africa/Kampala',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  }).replace(', ', 'T')
}

function getExpiryDate() {
  const now = new Date()
  const kampalaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Kampala' }))
  kampalaTime.setFullYear(kampalaTime.getFullYear() + 1)
  kampalaTime.setHours(23, 59, 59, 999)
  return kampalaTime.toISOString()
}

export async function POST(request) {
  try {
    const { phone, vipLevel } = await request.json()
    const cleanPhone = phone?.replace(/\s+/g, '')
    
    if (!cleanPhone) return Response.json({ success: false, message: 'Phone required' })

    const userKey = `phone:palamedes:${cleanPhone}`
    const user = await kv.hgetall(userKey)
    
    if (!user || !user.username) {
      return Response.json({ success: false, message: 'User not found' })
    }

    const currentVip = Number(user.vip) || 0
    const currentPricePaid = Number(user.vipPricePaid) || 0
    const balance = Number(user.balance) || 0
    const newPrice = VIP_CONFIG[vipLevel].price

    if (vipLevel <= currentVip) {
      return Response.json({ success: false, message: 'Cannot downgrade VIP' })
    }

    if (balance < newPrice) {
      return Response.json({ success: false, message: 'Insufficient balance' })
    }

    const refundedBalance = balance + currentPricePaid - newPrice
    const newExpiry = getExpiryDate()
    const nowISO = getKampalaISO()
    const nowTime = getKampalaTime()

    // Update user - this locks previous level automatically
    await kv.hset(userKey,
      'balance', String(refundedBalance),
      'vip', String(vipLevel),
      'vipPricePaid', String(newPrice),
      'vipExpiry', newExpiry,
      'vipPurchasedAt', nowISO,
      'vipLocked', 'false',
      'tasksCompleted', '0'
    )

    // Update username key too
    await kv.hset(`user:palamedes:${user.username.toLowerCase()}`,
      'balance', String(refundedBalance),
      'vip', String(vipLevel),
      'vipPricePaid', String(newPrice),
      'vipExpiry', newExpiry,
      'vipPurchasedAt', nowISO,
      'vipLocked', 'false',
      'tasksCompleted', '0'
    )

    // Commission for referrer if first upgrade from VIP 0
    if (currentVip === 0 && user.referrer_phone) {
      const inviterKey = `phone:palamedes:${user.referrer_phone}`
      const inviter = await kv.hgetall(inviterKey)
      if (inviter) {
        const newInviterBalance = (Number(inviter.balance) || 0) + COMMISSION[vipLevel]
        await kv.hset(inviterKey, 'balance', String(newInviterBalance))
        await kv.hset(`user:palamedes:${inviter.username.toLowerCase()}`, 'balance', String(newInviterBalance))
        
        await kv.lpush(`tx:palamedes:${user.referrer_phone}`, JSON.stringify({
          type: 'commission',
          amount: COMMISSION[vipLevel],
          date: nowTime,
          desc: `Commission from ${user.username} buying VIP${vipLevel}`
        }))
      }
    }

    // Log refund transaction for old VIP level
    if (currentPricePaid > 0 && currentVip > 0) {
      await kv.lpush(`tx:palamedes:${cleanPhone}`, JSON.stringify({
        type: 'refund',
        amount: currentPricePaid,
        date: nowTime,
        desc: `VIP${currentVip} refund on upgrade to VIP${vipLevel}`
      }))
    }

    // Log purchase transaction for new VIP level
    await kv.lpush(`tx:palamedes:${cleanPhone}`, JSON.stringify({
      type: 'vip',
      amount: -newPrice,
      date: nowTime,
      desc: `Purchased VIP${vipLevel}`,
      expiry: newExpiry
    }))

    const updatedUser = await kv.hgetall(userKey)

    return Response.json({
      success: true,
      message: `VIP${vipLevel} activated! Refund: ${currentPricePaid}shs. Expires: ${new Date(newExpiry).toLocaleDateString('en-GB')}`,
      user: {
        username: updatedUser.username,
        phone: updatedUser.phone,
        balance: Number(updatedUser.balance) || 0,
        vip: Number(updatedUser.vip) || 0,
        vipExpiry: updatedUser.vipExpiry,
        vipPurchasedAt: updatedUser.vipPurchasedAt,
        avatar: updatedUser.avatar || '',
        nickname: updatedUser.nickname || '',
        tasks_read_today: Number(updatedUser.tasksCompleted) || 0
      }
    })

  } catch (err) {
    console.error('VIP buy error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}