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
      return NextResponse.json({ 
        success: false,
        error: 'Server configuration error' 
      }, { status: 500 })
    }

    // UPWORK OAuth URL
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    
    // ✅ CORRECT SCOPE - read jobs
    authUrl.searchParams.set('scope', 'search:jobs')
    
    // Add state to identify user
    const state = `user_${user.id}_${Date.now()}`
    authUrl.searchParams.set('state', state)

    console.log('🔗 Generating Upwork OAuth URL...')
    console.log('Client ID:', clientId)
    console.log('Redirect URI:', redirectUri)
    console.log('State:', state)
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      message: 'Upwork OAuth URL generated'
    })
  } catch (error: any) {
    console.error('❌ OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 })
  }
}