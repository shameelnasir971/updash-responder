// app/api/upwork/auth/route.ts - SUPER SIMPLE VERSION
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
        error: 'Configuration missing'
      })
    }
    
    // ✅ SIMPLE URL WITHOUT ANY EXTRA PARAMS
    const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`
    
    return NextResponse.json({
      success: true,
      url: authUrl,
      message: 'URL generated'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      url: null,
      error: error.message
    })
  }
}