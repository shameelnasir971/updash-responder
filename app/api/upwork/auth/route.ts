// app/api/upwork/auth/route.ts - SIMPLE AND WORKING
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const clientId = process.env.UPWORK_CLIENT_ID || "b2cf4bfa369cac47083f664358d3accb"
    
    // Multiple redirect URIs try karne ke liye
    const redirectUris = [
      process.env.UPWORK_REDIRECT_URI,
      "https://updash.shameelnasir.com/api/upwork/callback",
      "https://updash.shameelnasir.com/auth/upwork/callback"
    ]
    
    const redirectUri = redirectUris.find(uri => uri && uri.startsWith('https')) || 
                       "https://updash.shameelnasir.com/api/upwork/callback"

    console.log('🔗 Using Redirect URI:', redirectUri)

    // Generate secure state
    const state = crypto.randomBytes(16).toString('hex') + `_user_${user.id}_${Date.now()}`
    
    // Store state in session or database for verification
    // (Optional: Use Redis or temporary table)

    // UPWORK OAuth URL with ALL required parameters
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    
    // ✅ IMPORTANT: Correct scope for jobs
    authUrl.searchParams.set('scope', 'search:jobs read:jobs')
    
    // State for CSRF protection
    authUrl.searchParams.set('state', state)
    
    // Additional parameters Upwork requires
    authUrl.searchParams.set('display', 'page')
    authUrl.searchParams.set('access_type', 'online')
    authUrl.searchParams.set('prompt', 'consent')

    console.log('🔗 Generated Upwork OAuth URL')
    console.log('Client ID:', clientId)
    console.log('Redirect URI:', redirectUri)
    console.log('State:', state.substring(0, 20) + '...')
    console.log('Scope:', 'search:jobs read:jobs')
    
    // Return both URL and state for frontend to store
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      state: state,
      message: 'Upwork OAuth URL generated successfully'
    })
  } catch (error: any) {
    console.error('❌ OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message || 'Internal server error',
      url: null
    }, { status: 500 })
  }
}