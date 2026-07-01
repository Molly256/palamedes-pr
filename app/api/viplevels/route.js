export async function POST(req) {
  try {
    const { phone, action, payload } = await req.json() // <- match frontend
    if (!phone || action !== 'BUY_VIP') return NextResponse.json({ success: false, message: 'Missing data' }, { status: 400 })

    const vipLevel = payload?.vipLevel
    if (!vipLevel) return NextResponse.json({ success: false, message: 'Missing VIP level' }, { status: 400 })

    const userKey = `user:${phone}`
    const user = await redis.hgetall(userKey)
    if (!user?.phone) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 })

    const selectedVip = VIPS[vipLevel]
    if (!selectedVip) return NextResponse.json({ success: false, message: 'Invalid VIP level' }, { status: 400 })

    const currentVip = Number(user.vip || 0)
    if (vipLevel <= currentVip) return NextResponse.json({ success: false, message: 'You already have this VIP or higher' }, { status: 400 })
    if (vipLevel > 3) return NextResponse.json({ success: false, message: 'VIP 4-10 is locked' }, { status: 400 }) // <- padlock enforce

    const currentPricePaid = Number(user.vipPricePaid || 0)
    const upgradeCost = selectedVip.price // <- full price required per your rule
    const currentBalance = Number(user.availableBalance || 0)
    if (currentBalance < upgradeCost) return NextResponse.json({ success: false, message: 'Insufficient Available Balance' }, { status: 400 })

    const isFirstTimePurchase = user.hasBoughtVip !== 'true' && user.hasBoughtVip !== true
    let newBalance = currentBalance - upgradeCost // pay full first

    // 2026-MM-DD and 2026-MM-DD HH:mm Kampala
    const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' }) // 2026-06-30
    const timeStr = new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).slice(0,16).replace(',', ' ') // 2026-06-30 14:32
    const txKey = `tx:${phone}:${dateStr}` // <- full year key

    const pipeline = redis.pipeline()
    let unlockedBooks = safeParse(user.unlockedBooks)
    let assignedBooksMeta = []

    if (isFirstTimePurchase) {
      const assignedData = await assignBooksToUser(phone, vipLevel, dateStr, pipeline)
      unlockedBooks = assignedData.unlockedBooks
      assignedBooksMeta = assignedData.assignedBooksMeta

      // VIPLEVEL PURCHASE TX
      pipeline.lpush(txKey, JSON.stringify({
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'buy_vip', // <- for PURCHASE tab
        amount: String(-selectedVip.price),
        note: `${selectedVip.name} Purchase`,
        status: 'completed',
        createdAt: timeStr, // <- under amount
        payload: { vipLevel, books: selectedVip.books, perBook: selectedVip.perBook }
      }))
    } else {
      // Refund old level immediately
      newBalance = newBalance + currentPricePaid

      // REFUND TAB TX 
      pipeline.lpush(txKey, JSON.stringify({
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'refund_vip', // <- for REFUND tab
        amount: String(currentPricePaid),
        note: `VIP ${currentVip} Refund`,
        status: 'completed',
        createdAt: timeStr, // <- under amount
        payload: { vipLevel: currentVip }
      }))

      // VIPLEVEL PURCHASE TX for new level
      pipeline.lpush(txKey, JSON.stringify({
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        type: 'buy_vip',
        amount: String(-selectedVip.price),
        note: `${selectedVip.name} Purchase`,
        status: 'completed',
        createdAt: timeStr,
        payload: { vipLevel, books: selectedVip.books, perBook: selectedVip.perBook }
      }))
    }

    pipeline.hset(userKey, {
      vip: String(vipLevel), 
      vipPricePaid: String(selectedVip.price),
      availableBalance: String(newBalance), 
      hasBoughtVip: 'true',
      vipExpiry: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      unlockedBooks: JSON.stringify(unlockedBooks), 
      completedBooks: '[]',
      books_read_today: '0', 
      dailyIncome: '0', 
      lastResetDate: dateStr, 
      vip_bought_date: dateStr
    })

    await pipeline.exec()

    if (isFirstTimePurchase) {
      await payInvitationReward(phone, vipLevel)
    }

    const updatedUser = await redis.hgetall(userKey)
    updatedUser.unlockedBooks = safeParse(updatedUser.unlockedBooks)
    updatedUser.availableBalance = Number(updatedUser.availableBalance || 0)
    updatedUser.vip = Number(updatedUser.vip || 0)
    if (updatedUser.balance) delete updatedUser.balance;

    return NextResponse.json({ success: true, user: updatedUser, books: assignedBooksMeta })
  } catch (err) {
    console.error('POST /api/viplevels error:', err)
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 })
  }
}