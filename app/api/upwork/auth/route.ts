// app/api/upwork/auth/route.ts - MINIMAL SCOPE VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI
    
    if (!clientId) {
      return NextResponse.json({ 
        success: false,
        error: 'UPWORK_CLIENT_ID missing' 
      }, { status: 500 })
    }
    
    // ✅ ONLY BASIC SCOPE - jo definitely allowed hai
    const scopes = encodeURIComponent('r_basic')
    
    // ✅ OAuth URL with only basic scope
    const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri || '')}&scope=${scopes}`
    
    console.log('🔗 Minimal OAuth URL:', authUrl)
    
    return NextResponse.json({ 
      success: true,
      url: authUrl,
      message: 'Upwork OAuth URL generated with basic scope'
    })
  } catch (error: any) {
    console.error('OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}