// app/api/upwork/callback/route.ts - UPDATED (COMPLETE TOKEN EXCHANGE)
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

    console.log('📥 Callback received:', { code: code ? 'Present' : 'Missing', error, state })

    if (error) {
      console.error('❌ OAuth error from Upwork:', error)
      return NextResponse.redirect(
        `${process.env.NODE_ENV === 'production' 
          ? 'https://updash.shameelnasir.com' 
          : 'http://localhost:3000'
        }/dashboard?error=oauth_failed&message=${encodeURIComponent(error)}`
      )
    }

    if (!code) {
      return NextResponse.redirect(
        `${process.env.NODE_ENV === 'production' 
          ? 'https://updash.shameelnasir.com' 
          : 'http://localhost:3000'
        }/dashboard?error=no_authorization_code`
      )
    }

    console.log('✅ Received authorization code')

    // Extract user ID from state
    const userId = state ? state.split('_')[1] : null
    if (!userId) {
      return NextResponse.redirect(
        `${process.env.NODE_ENV === 'production' 
          ? 'https://updash.shameelnasir.com' 
          : 'http://localhost:3000'
        }/dashboard?error=invalid_user_state`
      )
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = process.env.NODE_ENV === 'production' 
      ? 'https://updash.shameelnasir.com/api/upwork/callback'
      : 'http://localhost:3000/api/upwork/callback'

    if (!clientId || !clientSecret) {
      console.error('❌ Missing Upwork credentials')
      return NextResponse.redirect(
        `${process.env.NODE_ENV === 'production' 
          ? 'https://updash.shameelnasir.com' 
          : 'http://localhost:3000'
        }/dashboard?error=oauth_not_configured`
      )
    }

    console.log('🔄 Exchanging code for access token...')
    
    // ✅ CORRECT TOKEN EXCHANGE URL
    const tokenUrl = 'https://www.upwork.com/api/v3/oauth2/token'
    
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
    const tokenResponse = await fetch(tokenUrl, {
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
        error: errorText
      })
      return NextResponse.redirect(
        `${process.env.NODE_ENV === 'production' 
          ? 'https://updash.shameelnasir.com' 
          : 'http://localhost:3000'
        }/dashboard?error=token_exchange_failed&details=${encodeURIComponent(errorText)}`
      )
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful')
    
    // ✅ GET USER PROFILE INFO
    console.log('🔄 Getting Upwork user profile...')
    
    const profileResponse = await fetch('https://www.upwork.com/api/auth/v1/info.json', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    })

    let upworkUserId = 'unknown'
    let upworkUserName = 'Unknown User'
    let upworkUserEmail = ''
    
    if (profileResponse.ok) {
      const profileData = await profileResponse.json()
      console.log('📊 Profile data:', JSON.stringify(profileData, null, 2))
      
      upworkUserId = profileData.info?.user?.uid || 'unknown'
      upworkUserName = profileData.info?.user?.full_name || 'Unknown User'
      upworkUserEmail = profileData.info?.user?.email || ''
      
      console.log('✅ Got Upwork user info:', {
        name: upworkUserName,
        email: upworkUserEmail,
        uid: upworkUserId
      })
    } else {
      const errorText = await profileResponse.text()
      console.warn('⚠️ Failed to get user info:', errorText)
    }

    // ✅ SAVE TOKENS TO DATABASE
    console.log('💾 Saving tokens to database for user:', userId)
    
    try {
      await pool.query(
        `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, upwork_user_id, upwork_user_name, upwork_user_email, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           access_token = $2, 
           refresh_token = $3, 
           upwork_user_id = $4,
           upwork_user_name = $5,
           upwork_user_email = $6,
           updated_at = NOW()`,
        [parseInt(userId), tokenData.access_token, tokenData.refresh_token, 
         upworkUserId, upworkUserName, upworkUserEmail]
      )
      
      console.log('✅ Upwork account connected and saved successfully!')
      
      // ✅ TEST API CONNECTION
      console.log('🧪 Testing API connection...')
      try {
        const testResponse = await fetch('https://www.upwork.com/api/profiles/v2/search/jobs.json?q=web+development&paging=0;10', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        })
        
        if (testResponse.ok) {
          const testData = await testResponse.json()
          console.log(`✅ API test successful! Available jobs: ${testData.jobs?.length || 0}`)
        } else {
          console.log('⚠️ API test failed, but tokens are saved')
        }
      } catch (testError) {
        console.log('ℹ️ API test error (non-critical):', testError)
      }

    } catch (dbError: any) {
      console.error('❌ Database error:', dbError)
      return NextResponse.redirect(
        `${process.env.NODE_ENV === 'production' 
          ? 'https://updash.shameelnasir.com' 
          : 'http://localhost:3000'
        }/dashboard?error=database_save_failed&message=${encodeURIComponent(dbError.message)}`
      )
    }

    // ✅ SUCCESS REDIRECT
    const successUrl = `${process.env.NODE_ENV === 'production' 
      ? 'https://updash.shameelnasir.com' 
      : 'http://localhost:3000'
    }/dashboard?success=upwork_connected&message=Your+Upwork+account+is+now+connected!&name=${encodeURIComponent(upworkUserName)}`
    
    console.log('✅ Redirecting to:', successUrl)
    return NextResponse.redirect(successUrl)

  } catch (error: any) {
    console.error('❌ Callback error:', error)
    return NextResponse.redirect(
      `${process.env.NODE_ENV === 'production' 
        ? 'https://updash.shameelnasir.com' 
        : 'http://localhost:3000'
      }/dashboard?error=callback_failed&message=${encodeURIComponent(error.message)}`
    )
  }
}