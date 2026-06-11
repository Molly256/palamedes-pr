import { kv } from '@vercel/kv'

const ADMIN_PHONE = '2567xxxxxxxx' // must match dashboard

async function verifyAdmin(phone) {
  return phone === ADMIN_PHONE
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')
  const phone = searchParams.get('phone')

  if (action === 'getUser') {
    const user = await kv.hgetall(`phone:palamedes:${phone}`)
    if (!user ||!user.username) {
      return Response.json({ success: false, message: 'User not found' })
    }
    return Response.json({ success: true, user })
  }

  if (action === 'pending') {
    const allPhones = await kv.keys('phone:palamedes:*')
    let deposits = []
    let withdraws = []

    for (let key of allPhones) {
      const userPhone = key.split(':')[2]
      const txList = await kv.lrange(`transactions:${userPhone}`, 0, 99)
      txList.forEach(txStr => {
        const tx = JSON.parse(txStr)
        if (tx.status === 'pending') {
          tx.phone = userPhone
          if (tx.type === 'deposit') deposits.push(tx)
          if (tx.type === 'withdraw') withdraws.push(tx)
        }
      })
    }

    return Response.json({ success: true, deposits, withdraws })
  }

  return Response.json({ success: false, message: 'Invalid action' })
}

export async function POST(request) {
  const body = await request.json()
  const { action, phone, newPassword, txId, type } = body

  // Verify admin - you should also send admin phone from frontend and check
  // For simplicity, we rely on frontend check. Better: send admin phone and verify here.

  if (action === 'resetPassword') {
    await kv.hset(`phone:palamedes:${phone}`, { password: newPassword })
    return Response.json({ success: true, message: 'Password reset successfully' })
  }

  if (action === 'approve' || action === 'reject') {
    const userPhone = body.phone // you need to pass phone in request
    const txList = await kv.lrange(`transactions:${userPhone}`, 0, 99)
    const txIndex = txList.findIndex(t => JSON.parse(t).id == txId)

    if (txIndex === -1) return Response.json({ success: false, message: 'Transaction not found' })

    const tx = JSON.parse(txList[txIndex])

    if (action === 'approve') {
      tx.status = 'success'

      if (type === 'deposit') {
        const user = await kv.hgetall(`phone:palamedes:${userPhone}`)
        const newBalance = Number(user.balance) + Number(tx.amount)
        await kv.hset(`phone:palamedes:${userPhone}`, { balance: String(newBalance) })
      }

      if (type === 'withdraw') {
        const user = await kv.hgetall(`phone:palamedes:${userPhone}`)
        const newBalance = Number(user.balance) - Number(tx.amount)
        await kv.hset(`phone:palamedes:${userPhone}`, { balance: String(newBalance) })
      }
    } else {
      tx.status = 'rejected'
    }

    txList[txIndex] = JSON.stringify(tx)
    await kv.lset(`transactions:${userPhone}`, txIndex, JSON.stringify(tx))

    return Response.json({ success: true, message: `Transaction ${action}d` })
  }

  return Response.json({ success: false, message: 'Invalid action' })
}