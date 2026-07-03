async function processHierarchicalCommissions(buyerPhone, buyerVipLevel) {
  try {
    const vipAmts = { 1: 80000, 2: 250000, 3: 790000 }, timeStr = getUgandanDateTimeString();
    const rates = [0.05, 0.02, 0.01], labels = ['A', 'B', 'C'], typeFlags = ['team_a_payout', 'team_b_payout', 'team_c_payout'];
    
    const parent = await redis.hget('user:' + buyerPhone, 'invited_by');
    if (!parent || !/^07\d{8}$/.test(String(parent).trim())) return;
    const cleanParent = String(parent).trim();

    const grandparent = await redis.hget('user:' + cleanParent, 'invited_by');
    const cleanGrandparent = grandparent && /^07\d{8}$/.test(String(grandparent).trim()) ? String(grandparent).trim() : null;

    let greatGrandparent = null;
    if (cleanGrandparent) {
      const ggrand = await redis.hget('user:' + cleanGrandparent, 'invited_by');
      greatGrandparent = ggrand && /^07\d{8}$/.test(String(ggrand).trim()) ? String(ggrand).trim() : null;
    }

    const chain = [cleanParent, cleanGrandparent, greatGrandparent];
    const dataFetches = chain.map(p => p ? redis.hmget('user:' + p, ['vip', 'hasBoughtVip']) : Promise.resolve(null));
    const uplineData = await Promise.all(dataFetches);

    const commissionPipeline = redis.pipeline();
    let hasQueuedOps = false;

    for (let i = 0; i < 3; i++) {
      const uplinePhone = chain[i];
      if (!uplinePhone) continue;

      const userData = uplineData[i] || [null, null];
      const uplineVip = Number(userData[0] || 0);
      const hasBoughtVipStatus = userData[1];

      if (hasBoughtVipStatus !== 'true' && hasBoughtVipStatus !== true) continue;

      if (uplineVip > 0) {
        const reward = Math.floor((vipAmts[Math.min(uplineVip, buyerVipLevel)] || 0) * rates[i]);
        if (reward > 0) {
          hasQueuedOps = true;
          commissionPipeline.lpush('tx:' + uplinePhone + ':history', JSON.stringify({ 
            id: 'tx_' + Date.now() + '_' + labels[i] + '_' + Math.random().toString(36).slice(2, 5), 
            type: typeFlags[i], label: 'commission', amount: String(reward), 
            note: 'Invitation Rewards (Team ' + labels[i] + ': ' + buyerPhone + ')', status: 'success', createdAt: timeStr 
          }));
          commissionPipeline.hincrby('user:' + uplinePhone, 'availableBalance', reward);
        }
      }
    }
    if (hasQueuedOps) await commissionPipeline.exec();
  } catch (err) { console.error('Commission crash:', err); }
}

function getUgandanDateTimeString() {
  return new Date().toLocaleString("en-CA", { timeZone: "Africa/Kampala", hour12: false }).slice(0,16).replace(',', '');
}