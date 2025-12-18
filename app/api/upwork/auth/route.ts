// app/api/upwork/auth/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const JWT_SECRET = process.env.JWT_SECRET!
const UPWORK_CLIENT_ID = process.env.UPWORK_CLIENT_ID!
const UPWORK_REDIRECT_URI = process.env.UPWORK_REDIRECT_URI!

export async function GET() {
  try {
    const token = cookies().get('session-token')?.value

    if (!token) {
      return NextResponse.json({
        success: false,
        error: 'Unauthorized'
      })
    }

    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch {
      return NextResponse.json({
        success: false,
        error: 'Invalid session'
      })
    }

    // 🔐 OAuth URL (NO redirect here)
    const authUrl =
      `https://www.upwork.com/ab/account-security/oauth2/authorize` +
      `?client_id=${UPWORK_CLIENT_ID}` +
      `&response_type=code` +
      `&redirect_uri=${encodeURIComponent(UPWORK_REDIRECT_URI)}`

    return NextResponse.json({
      success: true,
      url: authUrl
    })

  } catch (error) {
    console.error('Upwork auth error:', error)
    return NextResponse.json({
      success: false,
      error: 'Auth failed'
    })
  }
}
