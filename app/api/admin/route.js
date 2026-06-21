import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()
const ADMIN_PHONES = ['0753520252']

function normalizePhone(phone) {
  if (!phone) return ''
  phone = String(phone).replace(/\D/g, '')

  if (phone.startsWith('256') && phone.length === 12) {
    phone = '0' + phone.slice(3)
  }
  if (phone.length === 9 &&!phone.startsWith('0')) {
    phone = '0' + phone
  }

  if (!/^07\d{8}$/.test(phone)) return ''
  return phone
}

async function verifyAdmin(phone) {
  return ADMIN_PHONES.includes(normalizePhone(phone))
}

async function getUserData(phone) {
  const user = await redis.hgetall(`user:${phone}`)
  return user && Object.keys(user).length > 0? user : null
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone')
    const action = searchParams.get('action')

    if (!await verifyAdmin(phone)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    if (action === 'pending') {
      const allPhones = await redis.smembers('users:phones')
      const deposits = []
      const withdraws = []

      for (const p of allPhones) {
        const txList = await redis.lrange(`tx:${p}`, 0, 999)
        for (const txStr of txList) {
          const tx = JSON.parse(txStr)
          if (tx.status === 'pending') {
            const user = await redis.hgetall(`user:${p}`)
            tx.balance = user.balance
            tx.available_balance = user.available_balance

            // Wrap in data field to match frontend
            const wrapped = {
              id: tx.id,
              phone: p,
              data: tx
            }

            if (tx.type === 'deposit') deposits.push(wrapped)
            if (tx.type === 'withdraw') withdraws.push(wrapped)
          }
        }
      }

      deposits.sort((a, b) => new Date(a.data.created_at) - new Date(b.data.created_at))
      withdraws.sort((a, b) => new Date(a.data.created_at) - new Date(b.data.created_at))

      return NextResponse.json({ success: true, deposits, withdraws })
    }

    if (action === 'getUser') {
      const targetPhone = normalizePhone(searchParams.get('targetPhone'))
      const user = await getUserData(targetPhone)
      if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

      delete user.password
      return NextResponse.json({ success: true, user })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('GET /api/admin error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, phone, targetPhone, newPassword, txId, type } = body

    if (!await verifyAdmin(phone)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
    }

    if (action === 'resetPassword') {
      const targetPhoneNorm = normalizePhone(targetPhone)
      if (!newPassword || newPassword.length < 6) {
        return NextResponse.json({ success: false, message: 'Password must be 6+ chars' }, { status: 400 })
      }

      const user = await getUserData(targetPhoneNorm)
      if (!user) return NextResponse.json({ success: false, message: 'Target user not found' }, { status: 404 })

      await redis.hset(`user:${targetPhoneNorm}`, { password: newPassword })
      return NextResponse.json({ success: true, message: 'Password reset successfully' })
    }

    // Handle approve/reject for both deposits and withdraws
    if (action === 'approve_deposit' || action === 'reject_deposit' ||
        action === 'approve_withdraw' || action === 'reject_withdraw') {

      const targetPhoneNorm = normalizePhone(targetPhone)
      const isApprove = action.startsWith('approve')
      const txType = action.includes('deposit')? 'deposit' : 'withdraw'

      const txList = await redis.lrange(`tx:${targetPhoneNorm}`, 0, 999)
      let txIndex = -1
      let tx = null

      for (let i = 0; i < txList.length; i++) {
        const t = JSON.parse(txList[i])
        if (t.id === txId && t.status === 'pending') {
          txIndex = i
          tx = t
          break
        }
      }

      if (!tx) return NextResponse.json({ success: false, message: 'Transaction not found or already processed' })

      const newStatus = isApprove? 'success' : 'rejected'
      tx.status = newStatus

      await redis.lset(`tx:${targetPhoneNorm}`, txIndex, JSON.stringify(tx))

      if (isApprove) {
        if (txType === 'deposit') {
          const user = await redis.hgetall(`user:${targetPhoneNorm}`)
          const current = Number(user.balance || 0)
          const newBal = current + Number(tx.amount)
          await redis.hset(`user:${targetPhoneNorm}`, { balance: newBal, available_balance: newBal })
        }

        if (txType === 'withdraw') {
          const withdrawAmount = Math.abs(Number(tx.amount))
          const user = await redis.hgetall(`user:${targetPhoneNorm}`)
          const currentBalance = Number(user.balance || 0)

          if (currentBalance < withdrawAmount) {
            throw new Error('Insufficient balance')
          }

          const newBal = currentBalance - withdrawAmount
          await redis.hset(`user:${targetPhoneNorm}`, { balance: newBal, available_balance: newBal })
        }
      }

      return NextResponse.json({ success: true, message: `Transaction ${newStatus}` })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/admin error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}