// app/api/upwork/callback/route.ts - UPDATED AND FIXED
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

    console.log('🔄 Upwork OAuth Callback Received:', { 
      code: !!code, 
      error, 
      state 
    })

    if (error) {
      console.error('❌ OAuth error from Upwork:', error)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error))
    }

    if (!code) {
      console.error('❌ No authorization code received')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_code')
    }

    // Extract user ID from state
    let userId = null
    if (state && state.startsWith('user_')) {
      const parts = state.split('_')
      if (parts.length >= 2) {
        userId = parseInt(parts[1])
      }
    }

    if (!userId) {
      console.error('❌ Could not extract user ID from state')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=invalid_state')
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = process.env.UPWORK_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('❌ Missing OAuth configuration')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=server_config')
    }

    console.log('🔄 Exchanging authorization code for access token...')

    // Exchange code for access token using Basic Auth
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
    const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText
      })
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=token_exchange_failed')
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful:', {
      access_token: tokenData.access_token ? 'Present' : 'Missing',
      refresh_token: tokenData.refresh_token ? 'Present' : 'Missing',
      expires_in: tokenData.expires_in
    })

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
        [userId, tokenData.access_token, tokenData.refresh_token]
      )
      
      console.log('✅ Tokens saved to database for user:', userId)
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=database_error')
    }

    console.log('✅ Upwork account connected successfully!')
    
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&reload=true')

  } catch (error: any) {
    console.error('❌ Callback error:', error.stack || error.message)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=callback_error')
  }
}