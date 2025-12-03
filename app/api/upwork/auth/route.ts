//app/api/upwork/auth/route.ts


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

    // ✅ HARCODE LIVE URL - NO ENVIRONMENT VARIABLE
    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'
    
    if (!clientId) {
      return NextResponse.json({ 
        success: false,
        error: 'UPWORK_CLIENT_ID missing in Railway variables' 
      }, { status: 500 })
    }

    // ✅ REAL UPWORK URL WITH CORRECT SCOPE
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', 'r_basic r_work r_jobs r_search r_proposals w_proposals r_manage')
    
    const state = `user_${user.id}_${Date.now()}`
    authUrl.searchParams.set('state', state)

    console.log('🎯 PRODUCTION OAuth URL generated for:', user.email)
    console.log('🔗 Redirect URI:', redirectUri)
    
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