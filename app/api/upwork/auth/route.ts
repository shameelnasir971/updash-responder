

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
    // ✅ SAHI REDIRECT URI USE KAREIN
    const redirectUri = process.env.NODE_ENV === 'production' 
      ? 'https://updash.shameelnasir.com/api/upwork/callback'
      : 'http://localhost:3000/api/upwork/callback'
    
    if (!clientId) {
      return NextResponse.json({ 
        success: false,
        error: 'UPWORK_CLIENT_ID missing in environment variables' 
      }, { status: 500 })
    }

    // ✅ CORRECT UPWORK OAuth 2.0 URL with PROPER SCOPES
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    // ✅ CORRECT PARAMETERS (Upwork ke hisaab se)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('redirect_uri', redirectUri)
    
    // ✅ CORRECT SCOPES (Upwork documentation ke mutabiq)
    authUrl.searchParams.set('scope', 'r_workdiary r_basic r_search r_jobs r_messages r_proposals')
    
    // Add state to identify user
    const state = `user_${user.id}_${Date.now()}`
    authUrl.searchParams.set('state', state)

    console.log('🎯 Generating OAuth URL for user:', user.email)
    console.log('🔗 OAuth URL:', authUrl.toString())
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      message: 'OAuth URL generated successfully'
    })
  } catch (error: any) {
    console.error('OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 })
  }
}