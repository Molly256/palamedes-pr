export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const phone = searchParams.get('phone')

  // TEMP: fake data for testing UI
  return Response.json({
    success: true,
    totalCommission: 12500,
    teamA: [
      { username: 'john', phone: '0711111', vipLevel: 1, hasCommission: true },
      { username: 'mary', phone: '0722222', vipLevel: 0, hasCommission: false }
    ],
    teamB: [
      { username: 'peter', phone: '0733333', vipLevel: 2, hasCommission: true }
    ],
    teamC: []
  })
}