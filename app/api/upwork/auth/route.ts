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

    // Use environment variables
    const clientId = process.env.UPWORK_CLIENT_ID || "b2cf4bfa369cac47083f664358d3accb"
    
    // IMPORTANT: Use EXACT redirect URI as registered in Upwork
    const redirectUri = "https://updash.shameelnasir.com/api/upwork/callback"
    
    // Generate secure state
    const state = crypto.randomBytes(16).toString('hex')
    
    // Store state in session or database (simplified version)
    console.log('📝 Storing OAuth state:', state, 'for user:', user.id)

    // Correct Upwork OAuth URL with required parameters
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    // REQUIRED parameters for Upwork OAuth
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('state', `${user.id}_${state}`)
    
    // IMPORTANT: Add required scopes for job search
    authUrl.searchParams.set('scope', 'search:jobs read:applications')
    
    // Optional but recommended
    authUrl.searchParams.set('access_type', 'offline')
    authUrl.searchParams.set('prompt', 'consent')

    console.log('🔗 Generating Upwork OAuth URL...')
    console.log('📋 OAuth Parameters:')
    console.log('  Client ID:', clientId)
    console.log('  Redirect URI:', redirectUri)
    console.log('  Scope:', 'search:jobs read:applications')
    console.log('  State:', `${user.id}_${state}`)
    console.log('  Full URL:', authUrl.toString())
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      message: 'Upwork OAuth URL generated'
    })
  } catch (error: any) {
    console.error('❌ OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error',
      details: error.message 
    }, { status: 500 })
  }
}