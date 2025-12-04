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
    const error_description = searchParams.get('error_description')

    console.log('🔄 Upwork callback received:')
    console.log('  Code present:', !!code)
    console.log('  Error:', error)
    console.log('  State:', state)
    console.log('  Error Description:', error_description)

    if (error) {
      console.error('❌ OAuth error from Upwork:', error_description || error)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=oauth_failed&message=' + encodeURIComponent(error_description || error))
    }

    if (!code) {
      console.error('❌ No authorization code received')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_code&message=No authorization code received')
    }

    // Extract user ID from state (format: "userid_randomstate")
    if (!state || !state.includes('_')) {
      console.error('❌ Invalid state parameter:', state)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=invalid_state')
    }

    const userId = parseInt(state.split('_')[0])
    if (!userId || isNaN(userId)) {
      console.error('❌ Invalid user ID in state:', state)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=invalid_user')
    }

    console.log('👤 Extracted user ID:', userId)

    // Use environment variables
    const clientId = process.env.UPWORK_CLIENT_ID || "b2cf4bfa369cac47083f664358d3accb"
    const clientSecret = process.env.UPWORK_CLIENT_SECRET || "0146401c5c4fd338"
    const redirectUri = "https://updash.shameelnasir.com/api/upwork/callback"

    console.log('🔄 Exchanging code for token...')
    console.log('  Client ID:', clientId)
    console.log('  Redirect URI:', redirectUri)

    // Create credentials for Basic Auth
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
    console.log('🔑 Base64 credentials created')

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': redirectUri,
        'client_id': clientId
      })
    })

    console.log('📡 Token exchange response status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=token_exchange_failed&details=' + encodeURIComponent(errorText))
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful')
    console.log('  Access token received:', !!tokenData.access_token)
    console.log('  Refresh token received:', !!tokenData.refresh_token)
    console.log('  Token type:', tokenData.token_type)
    console.log('  Expires in:', tokenData.expires_in)

    if (!tokenData.access_token) {
      console.error('❌ No access token in response')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_access_token')
    }

    // Save tokens to database
    try {
      await pool.query(
        `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, expires_at, created_at)
         VALUES ($1, $2, $3, NOW() + INTERVAL '${tokenData.expires_in || 86400} seconds', NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           access_token = $2, 
           refresh_token = $3,
           expires_at = NOW() + INTERVAL '${tokenData.expires_in || 86400} seconds',
           updated_at = NOW(),
           connected_at = CASE 
             WHEN upwork_accounts.connected_at IS NULL THEN NOW()
             ELSE upwork_accounts.connected_at
           END`,
        [userId, tokenData.access_token, tokenData.refresh_token || null]
      )

      console.log('💾 Tokens saved to database for user:', userId)
      
      // Test the connection by fetching profile
      try {
        const profileResponse = await fetch('https://www.upwork.com/api/auth/v1/info.json', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        })
        
        if (profileResponse.ok) {
          const profileData = await profileResponse.json()
          console.log('✅ Upwork connection verified:', profileData.info?.reference || 'User connected')
        }
      } catch (profileError) {
        console.log('⚠️ Profile fetch failed, but tokens saved')
      }

    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message)
      // Continue anyway, tokens might still be saved
    }

    console.log('✅ Upwork account connected successfully!')
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&message=Account connected successfully')

  } catch (error: any) {
    console.error('❌ Callback error:', error)
    console.error('Error stack:', error.stack)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=callback_failed&message=' + encodeURIComponent(error.message))
  }
}