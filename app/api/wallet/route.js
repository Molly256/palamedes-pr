import { db } from '../redis.js'

function getKampalaTime() {
  return new Date().toLocaleString('en-GB', {
    timeZone: 'Africa/Kampala',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
  })
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')?.replace(/\s+/g, '')

    if (!phone) return Response.json({ success: false, message: 'Phone required' })

    const txList = await db.lrange(`tx:palamedes:${phone}`, 0, 99)
    const transactions = txList.map(tx => JSON.parse(tx))

    return Response.json({ success: true, transactions })
  } catch (err) {
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, phone, amount } = body
    const cleanPhone = phone?.replace(/\s+/g, '')
    const userKey = `phone:palamedes:${cleanPhone}`

    if (!cleanPhone) return Response.json({ success: false, message: 'Phone required' })

    const user = await db.hgetall(userKey)
    if (!user ||!user.username) return Response.json({ success: false, message: 'User not found' })

    let newBalance = Number(user.balance) || 0
    const username = user.username

    // DEPOSIT
    if (action === 'deposit') {
      const amt = Number(amount)
      if (!amt || amt <= 0) return Response.json({ success: false, message: 'Invalid amount' })

      newBalance += amt
      await db.hset(userKey, 'balance', String(newBalance))
      await db.hset(`user:palamedes:${username.toLowerCase()}`, 'balance', String(newBalance))

      await db.lpush(`tx:palamedes:${cleanPhone}`, JSON.stringify({
        type: 'deposit',
        amount: amt,
        date: getKampalaTime(),
        desc: 'Deposit'
      }))

      return Response.json({ success: true, balance: newBalance, message: 'Deposit successful' })
    }

    // WITHDRAW - 10% fee hidden
    if (action === 'withdraw') {
      const requestedAmt = Number(amount)
      if (!requestedAmt || requestedAmt <= 0) {
        return Response.json({ success: false, message: 'Invalid amount' })
      }

      const fee = Math.floor(requestedAmt * 0.1)
      const totalDeduct = requestedAmt + fee

      if (newBalance < totalDeduct) {
        return Response.json({ success: false, message: 'Insufficient balance' })
      }

      newBalance -= totalDeduct
      await db.hset(userKey, 'balance', String(newBalance))
      await db.hset(`user:palamedes:${username.toLowerCase()}`, 'balance', String(newBalance))

      // Save as -requestedAmt only, fee hidden
      await db.lpush(`tx:palamedes:${cleanPhone}`, JSON.stringify({
        type: 'withdraw',
        amount: -requestedAmt,
        date: getKampalaTime(),
        desc: 'Withdraw'
      }))

      return Response.json({
        success: true,
        balance: newBalance,
        deducted: requestedAmt,
        fee,
        message: 'Withdraw successful'
      })
    }

    return Response.json({ success: false, message: 'Invalid action' })
  } catch (err) {
    console.error('Wallet error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}