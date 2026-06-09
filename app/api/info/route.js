export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')

    if (type === 'about') {
      return Response.json({
        success: true,
        data: {
          title: 'About Palamedes',
          content: 'Palamedes is a daily task earning platform. Complete books Mon-Fri, earn money, upgrade VIP for higher income.',
          version: '1.0.0'
        }
      })
    }

    if (type === 'manager') {
      return Response.json({
        success: true,
        data: {
          whatsapp: '+447412283536'
        }
      })
    }

    return Response.json({ success: false, message: 'Invalid type' })
  } catch (err) {
    return Response.json({ success: false, message: err.message }, { status: 500 })
  }
}