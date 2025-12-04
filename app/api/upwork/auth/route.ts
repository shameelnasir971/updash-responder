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

    // ✅ CORRECT UPWORK OAUTH URL WITHOUT SCOPE PARAMETER
    // Upwork doesn't support scope parameter in initial request
    const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`
    
    // Add state to identify user
    const state = `user_${user.id}_${Date.now()}`

    const finalUrl = `${authUrl}&state=${encodeURIComponent(state)}`

    console.log('🔗 Generating Upwork OAuth URL...')
    console.log('Final URL:', finalUrl)
    
    return NextResponse.json({ 
      success: true,
      url: finalUrl,
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