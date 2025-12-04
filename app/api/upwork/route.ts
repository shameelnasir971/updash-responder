// app/api/upwork/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI

    if (!clientId || !redirectUri) {
      return NextResponse.json({ 
        success: false,
        error: 'Upwork OAuth not configured properly' 
      }, { status: 500 })
    }

    // Generate OAuth URL with correct scopes
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    
    // ✅ CORRECT SCOPES for Upwork API v3
    authUrl.searchParams.set('scope', 'r_workwebsites r_workdiary r_messages r_reports r_manage r_freelancer_profile r_workfeed')
    
    // State for security
    const state = `user_${user.id}_${Date.now()}`
    authUrl.searchParams.set('state', state)

    console.log('🔗 Generating Upwork OAuth URL...')
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      message: 'Upwork OAuth URL generated successfully'
    })
  } catch (error: any) {
    console.error('❌ Upwork API error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      details: error.message
    }, { status: 500 })
  }
}