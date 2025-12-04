// app/api/upwork/callback/route.ts - CORRECT CALLBACK
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

    if (error) {
      console.error('OAuth error:', error)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=oauth_failed&message=' + encodeURIComponent(error))
    }

    if (!code) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_authorization_code')
    }

    console.log('✅ Received authorization code, exchanging for token...')
    console.log('🎯 State:', state)

    // Extract user ID from state
    const userId = state ? state.split('_')[1] : null
    if (!userId) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=invalid_user_state')
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = process.env.UPWORK_REDIRECT_URI || 'https://shameelnasir.com/upwork/oauth/callback'

    if (!clientId || !clientSecret) {
      console.error('❌ Missing Upwork credentials')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=oauth_not_configured')
    }

    // Step 1: Exchange code for access token
    console.log('🔄 Exchanging code for access token...')
    
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
      console.error('❌ Token exchange failed:', errorText)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=token_exchange_failed')
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful:', tokenData)

    // Step 2: Get Upwork user info
    console.log('🔄 Getting Upwork user info...')
    
    const userInfoResponse = await fetch('https://www.upwork.com/api/auth/v1/info', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    })

    if (!userInfoResponse.ok) {
      console.error('❌ Failed to get user info')
      // Continue anyway, we'll save tokens without user info
    }

    let upworkUserId = 'unknown'
    let upworkUserName = 'Unknown User'
    
    if (userInfoResponse.ok) {
      const userInfo = await userInfoResponse.json()
      upworkUserId = userInfo.info?.user?.uid || 'unknown'
      upworkUserName = userInfo.info?.user?.full_name || 'Unknown User'
      console.log('✅ Got Upwork user info:', upworkUserName)
    }

    // Step 3: Save tokens to database
    console.log('💾 Saving tokens to database for user:', userId)
    
    try {
      await pool.query(
        `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, upwork_user_id, upwork_user_name, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           access_token = $2, 
           refresh_token = $3, 
           upwork_user_id = $4,
           upwork_user_name = $5,
           updated_at = NOW()`,
        [parseInt(userId), tokenData.access_token, tokenData.refresh_token, upworkUserId, upworkUserName]
      )
      
      console.log('✅ Upwork account connected and saved successfully!')
    } catch (dbError) {
      console.error('❌ Database error:', dbError)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=database_save_failed')
    }

    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&message=Your+Upwork+account+is+now+connected!')

  } catch (error: any) {
    console.error('❌ Callback error:', error)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=callback_failed&message=' + encodeURIComponent(error.message))
  }
}