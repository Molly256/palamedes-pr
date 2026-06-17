import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

const ADMIN_PHONES = ['0753520252']

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')

  // Convert 256753520252 -> 0753520252
  if (phone.startsWith('256') && phone.length === 12) {
    phone = '0' + phone.slice(3)
  }

  // Convert 753520252 -> 0753520252
  if (phone.length === 9 &&!phone.startsWith('0')) {
    phone = '0' + phone
  }
  return phone
}

function safeParse(val) {
  if (!val || typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return null }
}

async function verifyAdmin(phone) {
  return ADMIN_PHONES.includes(normalizePhone(phone))
}

// Raw data from KV - used for admin display
async function getUserDataRaw(phone) {
  const userKey = `user:${phone}`
  if ((await kv.type(userKey)) === 'hash') {
    const user = await kv.hgetall(userKey)
    return { user, userKey }
  }
  return { user: null, userKey: null }
}

// Normalized for logic - treats available_balance as balance
async function getUserData(phone) {
  const { user, userKey } = await getUserDataRaw(phone)
  if (!user) return { user: null, userKey: null }

  const balance = Number(user.balance?? user.available_balance?? 0)
  user.balance = balance
  user.available_balance = balance
  return { user, userKey }
}

// Update both balance fields at once so they never drift apart
async function syncBalanceFields(phone, amount) {
  const userKey = `user:${phone}`
  const amountStr = String(amount)
  await kv.hset(userKey, {
    balance: amountStr,
    available_balance: amountStr
  })
}

async function getTransactions(phone) {
  const key = `transactions:${phone}`
  if ((await kv.type(key))!== 'list') return []
  const raw = await kv.lrange(key, 0, 99)
  return raw.map(t => safeParse(t)).filter(Boolean)
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const phone = searchParams.get('phone')
  const action = searchParams.get('action')

  if (!await verifyAdmin(phone)) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
  }

  if (action === 'pending') {
    const keys = await kv.keys('user:*')
    let deposits = [], withdraws = []

    for (let key of keys) {
      if ((await kv.type(key))!== 'hash') continue
      const userPhone = key.split(':')[1]

      // Get RAW data so admin sees what's actually in DB
      const { user } = await getUserDataRaw(userPhone)
      if (!user) continue

      const txList = await getTransactions(userPhone)
      txList.forEach(tx => {
        if (tx?.status === 'pending') {
          tx.phone = userPhone
          tx.user_balance = user.balance || 0
          tx.user_available_balance = user.available_balance || 0

          if (tx.type === 'deposit') deposits.push(tx)
          if (tx.type === 'withdraw') withdraws.push(tx)
        }
      })
    }

    deposits.sort((a, b) => new Date(b.date) - new Date(a.date))
    withdraws.sort((a, b) => new Date(b.date) - new Date(a.date))

    return NextResponse.json({ success: true, deposits, withdraws })
  }

  if (action === 'getUser') {
    const targetPhone = normalizePhone(searchParams.get('targetPhone'))
    const { user } = await getUserDataRaw(targetPhone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    return NextResponse.json({ success: true, user })
  }

  return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
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
      const { userKey: targetKey } = await getUserDataRaw(targetPhoneNorm)
      if (!targetKey) return NextResponse.json({ success: false, message: 'Target user not found' }, { status: 404 })

      await kv.hset(targetKey, { password: newPassword })
      return NextResponse.json({ success: true, message: 'Password reset successfully' })
    }

    if (action === 'approve' || action === 'reject') {
      const targetPhoneNorm = normalizePhone(targetPhone)
      const rawList = await kv.lrange(`transactions:${targetPhoneNorm}`, 0, 99)
      const txList = rawList.map(t => safeParse(t)).filter(Boolean)

      const txIndex = txList.findIndex(t => t.id == txId)
      if (txIndex === -1) return NextResponse.json({ success: false, message: 'Transaction not found' })

      const tx = txList[txIndex]
      tx.status = action === 'approve'? 'success' : 'rejected'

      if (action === 'approve') {
        const { user: targetUser } = await getUserData(targetPhoneNorm)
        if (!targetUser) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

        const currentBalance = Number(targetUser.balance) || 0

        if (type === 'deposit') {
          const newBalance = currentBalance + Number(tx.amount)
          await syncBalanceFields(targetPhoneNorm, newBalance)
        }

        if (type === 'withdraw') {
          const newBalance = currentBalance - Math.abs(Number(tx.amount))
          await syncBalanceFields(targetPhoneNorm, newBalance)
        }
      }

      rawList[txIndex] = JSON.stringify(tx)
      await kv.del(`transactions:${targetPhoneNorm}`)
      if (rawList.length > 0) {
        await kv.lpush(`transactions:${targetPhoneNorm}`,...rawList)
      }

      return NextResponse.json({ success: true, message: `Transaction ${action}d` })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}