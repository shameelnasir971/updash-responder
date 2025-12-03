// app/api/upwork/auth/route.ts - UPDATED
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
    const redirectUri = process.env.UPWORK_REDIRECT_URI || 'https://updash.shameelnasir.com/api/upwork/callback'
    
    if (!clientId) {
      console.error('❌ UPWORK_CLIENT_ID missing')
      return NextResponse.json({ 
        success: false,
        error: 'Upwork configuration missing' 
      }, { status: 500 })
    }

    console.log('🎯 Generating OAuth URL for user:', user.email)
    console.log('🔑 Client ID:', clientId ? 'Present' : 'Missing')
    console.log('📍 Redirect URI:', redirectUri)

    // ✅ CORRECT UPWORK OAUTH 2.0 URL WITH NEW SCOPES
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    
    // ✅ SINGLE USER APP KE LIYE SAHI SCOPES
    authUrl.searchParams.set('scope', 'r_lite r_jobs r_contract r_search')
    
    // Add state to identify user
    const state = `user_${user.id}_${Date.now()}`
    authUrl.searchParams.set('state', state)

    console.log('🔗 Final OAuth URL:', authUrl.toString())
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      message: 'OAuth URL generated successfully',
      user: user.email
    })
  } catch (error) {
    console.error('❌ OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 })
  }
}