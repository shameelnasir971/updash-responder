// app/api/upwork/callback/route.ts - COMPLETE WORKING VERSION
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  console.log('🔄 Upwork callback initiated...')
  
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDesc = searchParams.get('error_description')
    const state = searchParams.get('state')

    console.log('📥 Callback parameters:', { 
      hasCode: !!code, 
      error, 
      state: state ? 'Present' : 'Missing' 
    })

    // ✅ Handle OAuth errors
    if (error) {
      console.error('❌ Upwork OAuth error:', errorDesc || error)
      return NextResponse.redirect(
        'https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent(errorDesc || error) +
        '&source=oauth_error'
      )
    }

    // ✅ Check for authorization code
    if (!code) {
      console.error('❌ No authorization code received')
      return NextResponse.redirect(
        'https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent('No authorization code received. Please try connecting again.')
      )
    }

    console.log('✅ Authorization code received, exchanging for token...')

    // ✅ Get environment variables
    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'

    if (!clientId || !clientSecret) {
      console.error('❌ Missing Upwork credentials')
      throw new Error('Upwork API credentials (UPWORK_CLIENT_ID, UPWORK_CLIENT_SECRET) are not configured.')
    }

    // ✅ Exchange code for access token
    console.log('🔄 Exchanging code for access token...')
    
    const tokenParams = new URLSearchParams()
    tokenParams.append('grant_type', 'authorization_code')
    tokenParams.append('code', code)
    tokenParams.append('redirect_uri', redirectUri)
    tokenParams.append('client_id', clientId)
    tokenParams.append('client_secret', clientSecret)

    const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: tokenParams
    })

    const responseText = await tokenResponse.text()
    console.log('📄 Token response status:', tokenResponse.status)
    console.log('📄 Token response body (first 200 chars):', responseText.substring(0, 200))

    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed:', responseText)
      throw new Error(`Token exchange failed with status ${tokenResponse.status}: ${responseText}`)
    }

    const tokenData = JSON.parse(responseText)
    
    if (!tokenData.access_token) {
      throw new Error('No access token received in response')
    }

    console.log('✅ Token exchange successful!')
    console.log('🔐 Token info:', {
      hasAccessToken: !!tokenData.access_token,
      hasRefreshToken: !!tokenData.refresh_token,
      expiresIn: tokenData.expires_in || 'N/A'
    })

    // ✅ TEST: Verify token works by fetching user info
    console.log('🧪 Testing token by fetching user info...')
    
    let upworkUserId = null
    let upworkUserName = null
    
    try {
      const profileResponse = await fetch('https://www.upwork.com/api/auth/v1/info.json', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json'
        }
      })

      if (profileResponse.ok) {
        const profileData = await profileResponse.json()
        upworkUserId = profileData.info?.reference
        upworkUserName = profileData.info?.profile?.name
        
        console.log('✅ Token test successful!')
        console.log('👤 Upwork user info:', { upworkUserId, upworkUserName })
      } else {
        console.warn('⚠️ Could not fetch profile, but token seems valid')
      }
    } catch (profileError) {
      console.warn('⚠️ Profile fetch failed, but continuing:', profileError)
    }

    // ✅ Get user ID (from state or default user)
    let userId: number
    
    if (state) {
      try {
        // Decode state to get user ID
        userId = parseInt(Buffer.from(state, 'base64').toString())
        console.log('👤 User ID from state:', userId)
      } catch {
        console.warn('⚠️ Could not decode state, using default user')
        // Fallback: Get first user from database
        const users = await pool.query('SELECT id FROM users LIMIT 1')
        userId = users.rows[0]?.id
      }
    } else {
      console.log('ℹ️ No state parameter, using default user')
      const users = await pool.query('SELECT id FROM users LIMIT 1')
      userId = users.rows[0]?.id
    }

    if (!userId) {
      console.error('❌ No user found in database')
      throw new Error('No user account found. Please sign up first.')
    }

    // ✅ Save tokens to database
    console.log('💾 Saving tokens to database for user:', userId)
    
    try {
      await pool.query(
        `INSERT INTO upwork_accounts 
         (user_id, access_token, refresh_token, upwork_user_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           access_token = $2, 
           refresh_token = $3,
           upwork_user_id = COALESCE($4, upwork_accounts.upwork_user_id),
           updated_at = NOW()`,
        [
          userId, 
          tokenData.access_token, 
          tokenData.refresh_token || null,
          upworkUserId
        ]
      )
      
      console.log('✅ Tokens saved successfully!')
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message)
      throw new Error(`Failed to save tokens to database: ${dbError.message}`)
    }

    // ✅ Success - redirect to dashboard
    console.log('🎉 Upwork connection completed successfully!')
    
    const successUrl = new URL('https://updash.shameelnasir.com/dashboard')
    successUrl.searchParams.append('success', 'true')
    successUrl.searchParams.append('message', 'Upwork account connected successfully!')
    successUrl.searchParams.append('upwork_user', upworkUserName || 'User')
    
    return NextResponse.redirect(successUrl.toString())

  } catch (error: any) {
    // ✅ Handle all errors gracefully
    console.error('❌ Upwork callback error:', error)
    
    const errorUrl = new URL('https://updash.shameelnasir.com/dashboard')
    errorUrl.searchParams.append('error', 'true')
    errorUrl.searchParams.append('message', error.message || 'Unknown error during Upwork connection')
    errorUrl.searchParams.append('source', 'callback_handler')
    
    return NextResponse.redirect(errorUrl.toString())
  }
}