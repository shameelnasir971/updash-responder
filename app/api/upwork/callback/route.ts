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

    console.log('🔄 Upwork callback received:', { code: !!code, error, state })

    if (error) {
      console.error('❌ OAuth error from Upwork:', error)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=oauth_failed&message=' + encodeURIComponent(error))
    }

    if (!code) {
      console.error('❌ No authorization code received')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_code')
    }

    // Extract user ID from state
    const userId = state ? state.split('_')[1] : null
    if (!userId) {
      console.error('❌ Invalid state parameter')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=invalid_state')
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = process.env.UPWORK_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('❌ Missing environment variables')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=server_config')
    }

    console.log('🔄 Exchanging code for token...')
    console.log('Client ID:', clientId)
    console.log('Redirect URI:', redirectUri)

    // Exchange code for access token
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
    const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
        'Cache-Control': 'no-cache'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    })

    console.log('Token response status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=token_exchange_failed')
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful')
    console.log('Access token length:', tokenData.access_token?.length)

    // Save tokens to database
    try {
      await pool.query(
        `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           access_token = EXCLUDED.access_token, 
           refresh_token = EXCLUDED.refresh_token,
           updated_at = NOW()`,
        [parseInt(userId), tokenData.access_token, tokenData.refresh_token || null]
      )
      console.log('✅ Tokens saved to database')
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message)
      // Create table if not exists
      await pool.query(`
        CREATE TABLE IF NOT EXISTS upwork_accounts (
          user_id INTEGER PRIMARY KEY,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `).catch(console.error);
    }

    console.log('✅ Upwork account connected successfully!')

    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected')

  } catch (error: any) {
    console.error('❌ Callback error:', error.message || error)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=callback_failed&message=' + encodeURIComponent(error.message || 'Unknown error'))
  }
}