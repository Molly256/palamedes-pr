import { NextResponse } from 'next/server'

export async function GET(request) {
  try {
    const { searchParams } = request.nextUrl // <-- FIXED
    const type = searchParams.get('type')

    if (type === 'about') {
      return NextResponse.json({ // <-- Use NextResponse not Response
        success: true,
        data: {
          title: 'About Palamedes',
          content: 'Palamedes is a daily task earning platform. Complete books Mon-Fri, earn money, upgrade VIP for higher income.',
          version: '1.0.0'
        }
      })
    }

    if (type === 'manager') {
      return NextResponse.json({ // <-- Use NextResponse not Response
        success: true,
        data: {
          managers: [
            { name: 'Manager Maya', whatsapp: '+447412283536' },
            { name: 'Manager Zoe', whatsapp: '+447441424968' },
            { name: 'Manager Alicia', whatsapp: '+447451296569' }
          ]
        }
      })
    }

    return NextResponse.json({ success: false, message: 'Invalid type' }) // <-- Use NextResponse
  } catch (err) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 }) // <-- Use NextResponse
  }
}