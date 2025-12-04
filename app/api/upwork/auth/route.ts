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

    // ✅ **CORRECT UPWORK V3 OAUTH URL**
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    
    // 🚨 **UPWORK V3 - ONLY THESE SCOPES WORK:**
    // Option 1: Minimal scope (for testing)
    // authUrl.searchParams.set('scope', '')
    
    // Option 2: Basic scope that works
    authUrl.searchParams.set('scope', 'r_basic')
    
    // Option 3: If you need more permissions (use one of these):
    // authUrl.searchParams.set('scope', 'r_work')
    // authUrl.searchParams.set('scope', 'r_jobs')
    
    console.log('🔄 Testing with basic scope...')
    
    // Add state to identify user
    const state = `user_${user.id}_${Date.now()}`
    authUrl.searchParams.set('state', state)

    console.log('🔗 OAuth URL:', authUrl.toString())
    
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