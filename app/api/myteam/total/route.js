async function payInvitationReward(downlinePhone, vipLevelBought) {
  try {
    const inviterPhone = await redis.hget(`user:${downlinePhone}`, 'invited_by')
    if (!inviterPhone) return

    // 1. Get the link owner's actual active VIP tier level
    const inviterVip = Number(await redis.hget(`user:${inviterPhone}`, 'vip') || 0)
    if (inviterVip === 0) return // Free users don't earn team commission

    // Pool data configuration matrix matching your system requirements
    const vipAmounts = { 
      1: 80000, 2: 250000, 3: 790000, 4: 1000000, 5: 1500000, 
      6: 2100000, 7: 4000000, 8: 4600000, 9: 5000000, 10: 8000000 
    }

    // 2. BIDIRECTIONAL LOGIC COMPASS: Math.min enforces the cap perfectly
    // If inviterVip is 5 and bought is 2 -> Math.min(5, 2) uses 2 (Sarah's level)
    // If inviterVip is 1 and bought is 2 -> Math.min(1, 2) uses 1 (Moses's cap level)
    const effectiveVipTier = Math.min(inviterVip, vipLevelBought)
    
    const targetRewardAmount = vipAmounts[effectiveVipTier]
    if (!targetRewardAmount) return

    const level = Number(await redis.hget(`downlines:${inviterPhone}`, downlinePhone))
    if (!level || level > 3) return

    const rate = level === 1 ? 0.05 : level === 2 ? 0.02 : 0.01
    const rewardAmount = Math.floor(targetRewardAmount * rate)
    if (rewardAmount <= 0) return

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Kampala' })

    // 3. Write transaction log into the dated ledger key to sync with dashboard tabs
    await redis.lpush(`tx:${inviterPhone}:${today}`, JSON.stringify({
      id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`, 
      type: 'invitation_reward', 
      amount: String(rewardAmount),
      from: downlinePhone, 
      level, 
      vipLevel: String(vipLevelBought),
      date: today, 
      status: 'completed',
      createdAt: String(Date.now())
    }))

    // 4. Atomically increment the availableBalance key exclusively
    const inviterKey = `user:${inviterPhone}`
    await redis.hincrbyfloat(inviterKey, 'availableBalance', rewardAmount)

  } catch (err) { 
    console.error('Invitation reward error:', err) 
  }
}