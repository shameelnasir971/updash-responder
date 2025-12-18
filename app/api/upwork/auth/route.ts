// app/api/upwork/auth/route.ts - YEHI RAKHO, BAKI DELETE KAR DO
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI
    
    if (!clientId || !redirectUri) {
      return NextResponse.json({
        success: false,
        url: null,
        error: 'Upwork configuration missing in environment variables'
      })
    }
    
    const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`
    
    return NextResponse.json({
      success: true,
      url: authUrl,
      message: 'OAuth URL generated successfully'
    })
    
  } catch (error: any) {
    console.error('Upwork auth error:', error)
    return NextResponse.json({
      success: false,
      url: null,
      error: error.message || 'Internal error'
    })
  }
}