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

    // ✅ CORRECT SCOPES for Upwork API v2
    const scopes = [
      'hr:contracts',       // Read contracts
      'hr:jobs',           // Read jobs
      'hr:manage',         // Manage proposals
      'hr:proposals',      // Read/write proposals
    ].join(' ')

    // ✅ CORRECT Upwork OAuth URL
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scopes)
    
    // Add state to identify user
    const state = Buffer.from(JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
      origin: 'updash'
    })).toString('base64')
    
    authUrl.searchParams.set('state', state)

    console.log('🔗 Generating Upwork OAuth URL...')
    console.log('Scope:', scopes)
    console.log('State:', state)
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      state: state,
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