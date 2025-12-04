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
      hasCode: !!code, 
      error, 
      state 
    })

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

    console.log('🔄 Exchanging code for access token...')

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
      console.error('❌ Token exchange failed:', tokenResponse.status, errorText)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=token_failed')
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful')

    // Save tokens to database
    await pool.query(
      `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         access_token = $2, 
         refresh_token = $3,
         updated_at = NOW()`,
      [parseInt(userId), tokenData.access_token, tokenData.refresh_token || null]
    )

    console.log(`✅ Upwork account connected for user ${userId}!`)

    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected')

  } catch (error: any) {
    console.error('❌ Callback error:', error)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=callback_failed')
  }
}