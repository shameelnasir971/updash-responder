// app/api/upwork/callback/route.ts - WORKING VERSION
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    console.log('🔄 Upwork callback received:', { 
      code: code ? 'Yes' : 'No', 
      error, 
      state 
    })

    // If there's an error from Upwork
    if (error) {
      console.error('❌ OAuth error from Upwork:', error)
      const errorDesc = searchParams.get('error_description') || error
      return NextResponse.redirect(
        `https://updash.shameelnasir.com/dashboard?error=oauth_failed&message=${encodeURIComponent(errorDesc)}`
      )
    }

    if (!code) {
      console.error('❌ No authorization code received')
      return NextResponse.redirect(
        'https://updash.shameelnasir.com/dashboard?error=no_code'
      )
    }

    // Extract user ID from state
    let userId = 1; // Default fallback
    if (state && state.includes('user_')) {
      const parts = state.split('_');
      if (parts.length >= 2) {
        userId = parseInt(parts[1]) || 1;
      }
    }

    console.log('📝 User ID from state:', userId)

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = process.env.UPWORK_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('❌ Missing environment variables for OAuth')
      return NextResponse.redirect(
        'https://updash.shameelnasir.com/dashboard?error=server_config'
      )
    }

    console.log('🔄 Exchanging code for token...')
    console.log('Using Client ID:', clientId.substring(0, 8) + '...')

    // Exchange code for access token using application/x-www-form-urlencoded
    const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    })

    console.log('📡 Token response status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText)
      return NextResponse.redirect(
        'https://updash.shameelnasir.com/dashboard?error=token_exchange_failed'
      )
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful')
    console.log('Token received:', {
      access_token: tokenData.access_token ? 'Yes' : 'No',
      refresh_token: tokenData.refresh_token ? 'Yes' : 'No',
      expires_in: tokenData.expires_in
    })

    // Calculate expiration date
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + (tokenData.expires_in * 1000))
      : new Date(Date.now() + (3600 * 1000)) // Default 1 hour

    // Save tokens to database
    try {
      await pool.query(
        `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, expires_at, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           access_token = EXCLUDED.access_token, 
           refresh_token = EXCLUDED.refresh_token,
           expires_at = EXCLUDED.expires_at,
           updated_at = NOW()`,
        [userId, tokenData.access_token, tokenData.refresh_token, expiresAt]
      )
      console.log('✅ Tokens saved to database')
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message)
      // Continue anyway, don't fail the whole process
    }

    console.log('✅ Upwork account connected successfully!')

    // Redirect to dashboard with success message
    return NextResponse.redirect(
      'https://updash.shameelnasir.com/dashboard?success=upwork_connected'
    )

  } catch (error: any) {
    console.error('❌ Callback error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.redirect(
      `https://updash.shameelnasir.com/dashboard?error=callback_failed&message=${encodeURIComponent(error.message)}`
    )
  }
}