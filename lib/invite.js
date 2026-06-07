// lib/invite.js

// VIP prices for your 3 open levels
export const VIP_PRICES = {
 1: 80000,
 2: 250000,
 3: 790000
}

// Generate invite code from username + phone
export function generateInviteCode(username, phone) {
  if (!username ||!phone) return null
  const cleanUsername = username.replace(/[^a-z0-9]/gi, '').toUpperCase()
  const last4 = String(phone).slice(-4)
  return `${cleanUsername}${last4}`
}

// Save user + invite code to localStorage. Later swap with Upstash
export function saveUserData(phone, username) {
  const users = JSON.parse(localStorage.getItem('users') || '{}')
  const inviteCode = generateInviteCode(username, phone)

  users[phone] = {
   ...users[phone],
    username,
    phone,
    inviteCode,
    referrer: users[phone]?.referrer || null,
    vipLevel: users[phone]?.vipLevel || 0,
    vipPrice: VIP_PRICES[users[phone]?.vipLevel] || 0,
    balance: users[phone]?.balance || 0,
    createdAt: users[phone]?.createdAt || Date.now()
  }

  localStorage.setItem('users', JSON.stringify(users))

  // Code → phone lookup map
  const codeMap = JSON.parse(localStorage.getItem('inviteCodes') || '{}')
  codeMap[inviteCode] = phone
  localStorage.setItem('inviteCodes', JSON.stringify(codeMap))

  return inviteCode
}

// Get invite code for logged in user
export function getUserInviteCode(phone) {
  const users = JSON.parse(localStorage.getItem('users') || '{}')
  return users[phone]?.inviteCode || null
}

// Get phone from invite code - for referral tracking
export function getPhoneFromCode(code) {
  if (!code) return null
  const codeMap = JSON.parse(localStorage.getItem('inviteCodes') || '{}')
  return codeMap[code.toUpperCase()] || null
}

// Get user data by phone
export function getUser(phone) {
  const users = JSON.parse(localStorage.getItem('users') || '{}')
  return users[phone] || null
}

// Save referrer when user clicks /r/CODE link
export function saveReferrerCode(code) {
  if (code) {
    localStorage.setItem('referrerCode', code.toUpperCase())
  }
}

// Get + clear referrer code after signup
export function getAndClearReferrerCode() {
  const code = localStorage.getItem('referrerCode')
  localStorage.removeItem('referrerCode')
  return code
}