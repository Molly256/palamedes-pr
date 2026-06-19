import { db } from '../../../lib/db'
import { NextResponse } from 'next/server'

const ADMIN_PHONES = ['0753520252']

function normalizePhone(phone) {
  if (!phone) return ''
  phone = String(phone).replace(/\D/g, '')

  if (phone.startsWith('256') && phone.length === 12) {
    phone = '0' + phone.slice(3)
  }
  if (phone.length === 9 && !phone.startsWith('0')) {
    phone = '0' + phone
  }
  
  if (!/^07\d{8}$/.test(phone)) return ''
  return phone
}

async function verifyAdmin(phone) {
  return ADMIN_PHONES.includes(normalizePhone(phone))
}

async function getUserData(phone) {
  const res = await db.execute('SELECT * FROM users WHERE phone = ?', [phone])
  const user = res.rows[0] || null
  return user
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
      // Single query to get all pending transactions with user data
      const res = await db.execute(`
        SELECT t.*, u.balance, u.available_balance 
        FROM transactions t
        JOIN users u ON t.phone = u.phone
        WHERE t.status = 'pending'
        ORDER BY t.date ASC
      `)

      const deposits = []
      const withdraws = []

      for (const tx of res.rows) {
        if (tx.type === 'deposit') deposits.push(tx)
        if (tx.type === 'withdraw') withdraws.push(tx)
      }

      return NextResponse.json({ success: true, deposits, withdraws })
    }

    if (action === 'getUser') {
      const targetPhone = normalizePhone(searchParams.get('targetPhone'))
      const user = await getUserData(targetPhone)
      if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })
      
      // Don't send password
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

      await db.execute('UPDATE users SET password = ? WHERE phone = ?', [newPassword, targetPhoneNorm])
      return NextResponse.json({ success: true, message: 'Password reset successfully' })
    }

    if (action === 'approve' || action === 'reject') {
      const targetPhoneNorm = normalizePhone(targetPhone)

      const txRes = await db.execute(
        'SELECT * FROM transactions WHERE phone = ? AND id = ? AND status = "pending"',
        [targetPhoneNorm, txId]
      )
      const tx = txRes.rows[0]
      if (!tx) return NextResponse.json({ success: false, message: 'Transaction not found or already processed' })

      const newStatus = action === 'approve' ? 'success' : 'rejected'

      await db.transaction(async (txDb) => {
        // Update transaction status
        await txDb.execute(
          'UPDATE transactions SET status = ? WHERE phone = ? AND id = ?',
          [newStatus, targetPhoneNorm, txId]
        )

        // Only update balance on approval
        if (action === 'approve') {
          if (type === 'deposit') {
            // Atomic increment
            await txDb.execute(
              'UPDATE users SET balance = balance + ?, available_balance = available_balance + ? WHERE phone = ?',
              [tx.amount, tx.amount, targetPhoneNorm]
            )
          }

          if (type === 'withdraw') {
            const withdrawAmount = Math.abs(Number(tx.amount))
            // Check balance first
            const userRes = await txDb.execute('SELECT balance FROM users WHERE phone = ?', [targetPhoneNorm])
            const currentBalance = Number(userRes.rows[0]?.balance || 0)
            
            if (currentBalance < withdrawAmount) {
              throw new Error('Insufficient balance')
            }

            await txDb.execute(
              'UPDATE users SET balance = balance - ?, available_balance = available_balance - ? WHERE phone = ?',
              [withdrawAmount, withdrawAmount, targetPhoneNorm]
            )
          }
        }
      })

      return NextResponse.json({ success: true, message: `Transaction ${action}d` })
    }

    return NextResponse.json({ success: false, message: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/admin error:', err)
    return NextResponse.json({ success: false, message: err.message }, { status: 500 })
  }
}