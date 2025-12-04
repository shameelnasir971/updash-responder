// app/api/upwork/auth/route.ts - SIMPLE AND WORKING
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
    const redirectUri = process.env.UPWORK_REDIRECT_URI

    if (!clientId || !redirectUri) {
      console.error('❌ Missing environment variables:', {
        clientId: !!clientId,
        redirectUri: !!redirectUri
      })
      return NextResponse.json({ 
        success: false,
        error: 'Server configuration error' 
      }, { status: 500 })
    }

    // CORRECT UPWORK OAuth URL with proper scopes
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    
    // ✅ FIXED: Use correct scopes for job access
    // 'search_jobs' for job search, 'r_workdiary' for basic profile access
    authUrl.searchParams.set('scope', 'search_jobs r_workdiary r_myprofile')
    
    // Add user ID in state parameter
    const state = `user_${user.id}_${Date.now()}`
    authUrl.searchParams.set('state', state)

    console.log('🔗 Generating OAuth URL with parameters:', {
      clientId: clientId.substring(0, 10) + '...',
      redirectUri,
      scope: 'search_jobs r_workdiary r_myprofile',
      state
    })
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      message: 'Upwork OAuth URL generated successfully'
    })
  } catch (error: any) {
    console.error('❌ OAuth generation error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Internal server error'
    }, { status: 500 })
  }
}