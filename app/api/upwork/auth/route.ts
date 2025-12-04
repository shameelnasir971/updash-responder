// app/api/upwork/auth/route.ts - UPDATED WITH CORRECT SCOPE
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI || 'https://shameelnasir.com/upwork/oauth/callback'
    
    if (!clientId) {
      return NextResponse.json({ 
        success: false,
        error: 'UPWORK_CLIENT_ID missing in environment variables' 
      }, { status: 500 })
    }

    // REAL UPWORK OAuth 2.0 URL
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    
    // ✅ CORRECT SCOPE - sirf read permissions
    authUrl.searchParams.set('scope', 'r_basic r_jobs')
    
    // Add state to identify user
    const state = `user_${user.id}_${Date.now()}`
    authUrl.searchParams.set('state', state)

    console.log('🎯 Generating OAuth URL for user:', user.email)
    console.log('🔗 Redirect URI:', redirectUri)
    console.log('🔐 Scope: r_basic r_jobs')
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      message: 'OAuth URL generated successfully'
    })
  } catch (error) {
    console.error('OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 })
  }
}