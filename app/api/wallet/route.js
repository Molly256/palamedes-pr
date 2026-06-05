import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const body = await request.json()
    const { action, number, amount, method, names } = body

    if (!number || !amount) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    // Min 10k for both deposit + withdraw
    if (amount < 10000) {
      return NextResponse.json({ error: 'Min 10,000shs' }, { status: 400 })
    }

    if (action !== 'deposit' && action !== 'withdraw') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const isWithdraw = action === 'withdraw'
    const fee = isWithdraw ? Math.floor(amount * 0.1) : 0
    const netAmount = isWithdraw ? amount - fee : amount

    // TESTING: Auto approve both deposit + withdraw
    const tx = {
      id: Date.now(),
      number,
      type: action,
      amount: isWithdraw ? -amount : amount, // gross amount for balance deduction
      fee: fee, // 10% fee
      netAmount: netAmount, // what user receives after fee
      method: method || null,
      names: names || null,
      status: 'approved', // auto approve for testing
      date: new Date().toISOString()
    }

    return NextResponse.json({ success: true, tx })
    
  } catch (error) {
    console.error('Wallet API error:', error)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}