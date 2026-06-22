import { Redis } from '@upstash/redis'
import allBooks from '@/public/data/books.json'

const redis = Redis.fromEnv()

const VIPS = {
 1: { books: 4, perBook: 625, price: 80000 },
 2: { books: 4, perBook: 2000, price: 250000 },
 3: { books: 4, perBook: 6500, price: 790000 },
 4: { books: 5, perBook: 7000, price: 1000000 },
 5: { books: 5, perBook: 10000, price: 1500000 },
 6: { books: 5, perBook: 14000, price: 2100000 },
 7: { books: 5, perBook: 28000, price: 4000000 },
 8: { books: 5, perBook: 32000, price: 4600000 },
 9: { books: 5, perBook: 40000, price: 5000000 },
 10: { books: 5, perBook: 60000, price: 8000000 },
}

function shuffle(array) {
  let currentIndex = array.length
  while (currentIndex!== 0) {
    const randomIndex = Math.floor(Math.random() * currentIndex)
    currentIndex--
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]]
  }
  return array
}

function isWeekdayInUganda() {
  const ugandaDate = new Date().toLocaleString('en-US', { timeZone: 'Africa/Kampala' })
  const day = new Date(ugandaDate).getDay()
  return day >= 1 && day <= 5
}

function getUgandaDateString() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })
}

export async function POST(req) {
  try {
    const { phone, vipLevel } = await req.json()
    if (!phone ||!vipLevel) return Response.json({ success: false, message: 'Missing data' }, { status: 400 })

    const userKey = `user:${phone}`
    const user = await redis.hgetall(userKey)
    if (!user ||!user.phone) return Response.json({ success: false, message: 'User not found' }, { status: 404 })

    const selectedVip = VIPS[vipLevel]
    if (!selectedVip) return Response.json({ success: false, message: 'Invalid VIP level' })

    const currentVip = Number(user.vip || 0)
    if (vipLevel <= currentVip) return Response.json({ success: false, message: 'You already have this VIP or higher' })

    const currentPricePaid = Number(user.vipPricePaid || 0)
    const upgradeCost = selectedVip.price - currentPricePaid
    const availableBalance = Number(user.availableBalance || 0)

    if (availableBalance < upgradeCost) return Response.json({ success: false, message: 'Insufficient balance' })

    const isWeekday = isWeekdayInUganda()
    const today = getUgandaDateString()

    const updateData = {
      vip: vipLevel,
      vipPricePaid: selectedVip.price,
      availableBalance: availableBalance - upgradeCost,
      vipExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    }

    if (isWeekday) {
      const shuffled = shuffle([...allBooks])
      const selectedBooks = shuffled.slice(0, selectedVip.books).map(b => b.id.toString())
      updateData.unlockedBooks = JSON.stringify(selectedBooks)
      updateData.completedBooks = '[]'
      updateData.books_read_today = 0
      updateData.dailyIncome = 0
      updateData.lastResetDate = today
    } else {
      updateData.unlockedBooks = '[]'
      updateData.completedBooks = '[]'
      updateData.books_read_today = 0
      updateData.dailyIncome = 0
      updateData.lastResetDate = today
    }

    const pipeline = redis.pipeline()
    pipeline.hset(userKey, updateData)
    await pipeline.exec()

    await payInvitationReward(phone, vipLevel)

    const updatedUser = await redis.hgetall(userKey)
    updatedUser.unlockedBooks = JSON.parse(updatedUser.unlockedBooks || '[]')
    updatedUser.completedBooks = JSON.parse(updatedUser.completedBooks || '[]')
    updatedUser.availableBalance = Number(updatedUser.availableBalance)
    updatedUser.vip = Number(updatedUser.vip)
    updatedUser.books_read_today = Number(updatedUser.books_read_today)
    updatedUser.dailyIncome = Number(updatedUser.dailyIncome || 0)
    updatedUser.vipPricePaid = Number(updatedUser.vipPricePaid || 0)

    const message = isWeekday
  ? `Upgraded to VIP ${vipLevel} successfully. ${selectedVip.books} books assigned.`
      : `Upgraded to VIP ${vipLevel} successfully. Books will be assigned on the next weekday.`

    return Response.json({
      success: true,
      user: updatedUser,
      message
    })

  } catch (err) {
    console.error(err)
    return Response.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}

async function payInvitationReward(downlinePhone, vipLevelBought) {
  try {
    const inviterPhone = await redis.hget(`user:${downlinePhone}`, 'invited_by')
    if (!inviterPhone) return

    const inviterVip = Number(await redis.hget(`user:${inviterPhone}`, 'vip') || 0)
    const downlineVip = Number(vipLevelBought)

    if (inviterVip < downlineVip) return
    if (inviterVip === 0) return

    const vipAmounts = {
      1: 80000, 2: 250000, 3: 790000, 4: 1000000, 5: 1500000,
      6: 2100000, 7: 4000000, 8: 4600000, 9: 5000000, 10: 8000000
    }
    const inviterAmount = vipAmounts[inviterVip]
    if (!inviterAmount) return

    const level = Number(await redis.hget(`downlines:${inviterPhone}`, downlinePhone))
    if (!level || level > 3) return

    let rate = 0
    if (level === 1) rate = 0.05
    if (level === 2) rate = 0.02
    if (level === 3) rate = 0.01

    const rewardAmount = Math.floor(inviterAmount * rate)
    if (rewardAmount <= 0) return

    await redis.lpush(`tx:${inviterPhone}`, JSON.stringify({
      id: Date.now(),
      type: 'invitation_reward',
      amount: rewardAmount,
      from: downlinePhone,
      level: level,
      vipLevel: vipLevelBought,
      date: new Date().toISOString(),
      status: 'completed'
    }))

    await redis.hset(`user:${downlinePhone}`, 'vip_paid', '1')

  } catch (err) {
    console.error('Invitation reward error:', err)
  }
}