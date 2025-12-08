// app/api/upwork/auth/route.ts - COMPLETE FIXED
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
        error: 'Configuration missing' 
      }, { status: 200 }) // ✅ NO 500 ERROR
    }
    
    // ✅ SIMPLE URL WITHOUT AUTH CHECK
    const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`
    
    return NextResponse.json({ 
      success: true,
      url: authUrl,
      message: 'OAuth URL generated'
    })
  } catch (error: any) {
    console.error('OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 200 }) // ✅ NO 500 ERROR
  }
}