import { db } from '@/lib/db'

const TZ = 'Africa/Kampala'

function getUGDateStr(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(date)
}

function isValidInviteCode(code) {
  return /^PM\d{6}$/.test(code)
}

function getUserInviteCode(phone) {
  return `PM${phone.slice(-6)}`
}

function normalizeUser(user) {
  if (!user) return null
  const bal = Number(user.balance?? user.available_balance?? 0)
  return {
    id: user.id,
    username: user.username,
    phone: user.phone,
    balance: bal,
    available_balance: bal,
    hasBoughtVIP: user.hasBoughtVIP === 1,
    vip_level: Number(user.vip_level) || 0,
    vip_deposit: Number(user.vip_deposit) || 0,
    first_vip_amount: Number(user.first_vip_amount) || 0,
    vip_paid: user.vip_paid === 1,
    invite_code: user.invite_code || '',
    invited_by: user.invited_by || '',
    airtel_number: user.airtel_number || '',
    airtel_name: user.airtel_name || '',
    mtn_number: user.mtn_number || '',
    mtn_name: user.mtn_name || '',
    created_at: user.created_at || ''
  }
}

async function syncBalanceFields(phone, amount) {
  await db.execute(
    'UPDATE users SET balance =?, available_balance =? WHERE phone =?',
    [amount, amount, phone]
  )
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, username, password, phone, referral } = body

    // REGISTER
    if (action === 'register') {
      if (!username ||!password ||!phone) {
        return Response.json({ success: false, message: 'All fields required' })
      }

      if (!/^07\d{8}$/.test(phone)) {
        return Response.json({ success: false, message: 'Phone must be 10 digits starting with 07' })
      }

      if (!/^[a-zA-Z0-9]{6}$/.test(username)) {
        return Response.json({ success: false, message: 'Username must be 6 letters or digits' })
      }

      if (!/^[a-zA-Z0-9]{6}$/.test(password)) {
        return Response.json({ success: false, message: 'Password must be 6 letters or digits' })
      }

      const existingUser = await db.execute('SELECT phone FROM users WHERE phone =?', [phone])
      if (existingUser.rows.length > 0) {
        return Response.json({ success: false, message: 'Phone already registered' })
      }

      const existingUsername = await db.execute('SELECT id FROM users WHERE username =?', [username])
      if (existingUsername.rows.length > 0) {
        return Response.json({ success: false, message: 'Username taken' })
      }

      let invited_by = ''
      if (referral) {
        if (!isValidInviteCode(referral)) {
          return Response.json({ success: false, message: 'Invalid referral code format' })
        }
        const refRes = await db.execute('SELECT phone FROM users WHERE invite_code =?', [referral])
        if (refRes.rows.length === 0) {
          return Response.json({ success: false, message: 'Referral code not found' })
        }
        invited_by = refRes.rows[0].phone
        if (invited_by === phone) {
          return Response.json({ success: false, message: 'Cannot use your own referral code' })
        }
      }

      const invite_code = getUserInviteCode(phone)
      const created_at = getUGDateStr()

      await db.execute(
        `INSERT INTO users (
          username, phone, password, invite_code, invited_by,
          balance, available_balance, created_at,
          hasBoughtVIP, vip_level, vip_deposit, first_vip_amount, vip_paid
        ) VALUES (?,?, 2500, 2500,?, 0, 0, 0, 0, 0)`,
        [username, phone, password, invite_code, invited_by, created_at]
      )

      return Response.json({
        success: true,
        message: 'Registered successfully',
        invite_code
      })
    }

    // LOGIN
    if (action === 'login') {
      if (!phone ||!password) {
        return Response.json({ success: false, message: 'Phone and password required' })
      }

      const res = await db.execute('SELECT * FROM users WHERE phone =?', [phone])
      const user = res.rows[0]

      if (!user) {
        return Response.json({ success: false, message: 'User not found' })
      }

      if (user.password!== password) {
        return Response.json({ success: false, message: 'Invalid password' })
      }

      const currentBalance = Number(user.balance?? user.available_balance?? 0)
      if (user.balance!== currentBalance || user.available_balance!== currentBalance) {
        await syncBalanceFields(phone, currentBalance)
      }

      return Response.json({
        success: true,
        user: normalizeUser(user)
      })
    }

    return Response.json({ success: false, message: 'Invalid action' })
  } catch (err) {
    console.error('Auth error:', err)
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}