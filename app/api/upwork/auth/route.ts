

// app/api/upwork/auth/route.ts - COMPLETELY UPDATED
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
    const scopes = process.env.UPWORK_SCOPES || 'r_basic r_work r_proposals r_jobs_browse'
    
    if (!clientId) {
      return NextResponse.json({ 
        success: false,
        error: 'UPWORK_CLIENT_ID missing in environment variables' 
      }, { status: 500 })
    }

    console.log('🎯 Generating Upwork OAuth URL for user:', user.email)
    
    // ✅ FIXED: Correct Upwork OAuth 2.0 URL with proper scopes
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scopes) // ✅ NEW SCOPES
    
    // Add state for security
    const state = Buffer.from(`user_${user.id}_${Date.now()}_${Math.random()}`).toString('base64')
    authUrl.searchParams.set('state', state)

    console.log('🔗 Generated URL:', authUrl.toString())
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      state: state,
      message: 'Upwork OAuth URL generated successfully'
    })
  } catch (error: any) {
    console.error('❌ OAuth URL generation error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error: ' + error.message 
    }, { status: 500 })
  }
}