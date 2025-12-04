// app/api/upwork/auth/route.ts - SIMPLE AND WORKING
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import { cookies } from 'next/headers'

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

    // Create a secure state parameter
    const state = Buffer.from(`${user.id}:${Date.now()}:${Math.random()}`).toString('base64')
    
    // Store state in HTTP-only cookie for security
    const cookieStore = cookies()
    cookieStore.set('upwork_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300 // 5 minutes
    })

    // Also store user ID in separate cookie for callback
    cookieStore.set('upwork_user_id', user.id.toString(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300
    })

    // Build Upwork OAuth URL
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri)
    
    // IMPORTANT: Upwork requires these specific scopes
    authUrl.searchParams.append('scope', '')
    
    // Add state parameter
    authUrl.searchParams.append('state', state)

    console.log('🔗 Upwork OAuth URL generated for user:', user.email)
    console.log('State:', state)
    
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
      error: error.message || 'Internal server error' 
    }, { status: 500 })
  }
}