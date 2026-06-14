import { kv } from '@vercel/kv'
import { NextResponse } from 'next/server'

const ADMIN_PHONES = ['0753520252']

function normalizePhone(phone) {
  if (!phone) return phone
  phone = String(phone).replace(/\D/g, '')
  if (phone.length === 9 &&!phone.startsWith('0')) phone = '0' + phone
  return phone
}

function safeParse(val) {
  if (!val || typeof val === 'object') return val
  try { return JSON.parse(val) } catch { return null }
}

async function verifyAdmin(phone) {
  return ADMIN_PHONES.includes(normalizePhone(phone))
}

async function getUserData(phone) {
  const userKey = `user:${phone}`
  if ((await kv.type(userKey)) === 'hash') {
    const user = await kv.hgetall(userKey)
    return { user, userKey }
  }
  return { user: null, userKey: null }
}

async function getTransactions(phone) {
  const key = `transactions:${phone}`
  if ((await kv.type(key))!== 'list') return []
  const raw = await kv.lrange(key, 0, 99)
  return raw.map(t => safeParse(t)).filter(Boolean)
}

// GET: fetch pending deposits/withdraws
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
      const txList = await getTransactions(userPhone)
      txList.forEach(tx => {
        if (tx?.status === 'pending') {
          tx.phone = userPhone
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
    const { user } = await getUserData(targetPhone)
    if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
    return NextResponse.json({ success: true, user })
  }

  return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
}

// POST: reset password, approve, reject
export async function POST(request) {
  try {
    const body = await request.json()
    const { action, phone, targetPhone, newPassword, txId, type } = body

    if (!await verifyAdmin(phone)) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 403 })
    }

    if (action === 'resetPassword') {
      const targetPhoneNorm = normalizePhone(targetPhone)
      const { userKey: targetKey } = await getUserData(targetPhoneNorm)
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

      if (action === 'approve' && type === 'deposit') {
        const { user: targetUser, userKey: targetKey } = await getUserData(targetPhoneNorm)
        if (targetKey) {
          const newBalance = Number(targetUser.balance || 0) + Number(tx.amount)
          await kv.hset(targetKey, { balance: String(newBalance) })
        }
      }

      if (action === 'approve' && type === 'withdraw') {
        const { user: targetUser, userKey: targetKey } = await getUserData(targetPhoneNorm)
        if (targetKey) {
          const newBalance = Number(targetUser.balance || 0) - Math.abs(Number(tx.amount))
          await kv.hset(targetKey, { balance: String(newBalance) })
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