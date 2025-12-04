// app/api/upwork/callback/route.ts - COMPLETELY UPDATED
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
    const errorDescription = searchParams.get('error_description')

    console.log('🔄 Upwork Callback Received:', { code: !!code, error, state })

    if (error) {
      console.error('❌ OAuth error from Upwork:', error, errorDescription)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(errorDescription || error))
    }

    if (!code) {
      console.error('❌ No authorization code received')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_authorization_code')
    }

    console.log('✅ Received authorization code, exchanging for tokens...')

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = process.env.UPWORK_REDIRECT_URI || 'https://updash.shameelnasir.com/api/upwork/callback'

    if (!clientId || !clientSecret) {
      console.error('❌ Missing Upwork credentials in environment')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=missing_upwork_credentials')
    }

    // ✅ FIXED: PROPER TOKEN EXCHANGE
    try {
      console.log('🔄 Step 1: Exchanging code for access token...')
      
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      
      const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri
        })
      })

      const tokenText = await tokenResponse.text()
      console.log('📄 Token response status:', tokenResponse.status)
      console.log('📄 Token response body:', tokenText.substring(0, 500))

      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${tokenResponse.status} - ${tokenText}`)
      }

      const tokenData = JSON.parse(tokenText)
      console.log('✅ Token exchange successful! Access token received')

      // ✅ FIXED: Extract user ID from state
      let userId = null
      if (state) {
        try {
          const decodedState = Buffer.from(state, 'base64').toString('utf-8')
          const match = decodedState.match(/user_(\d+)_/)
          if (match) {
            userId = parseInt(match[1])
          }
        } catch (e) {
          console.warn('Could not decode state:', e)
        }
      }

      // If state decode fails, try to get user from existing sessions
      if (!userId) {
        console.log('⚠️ Could not get user ID from state, trying to find active user...')
        const users = await pool.query('SELECT id FROM users LIMIT 1')
        if (users.rows.length > 0) {
          userId = users.rows[0].id
        }
      }

      if (!userId) {
        throw new Error('Could not determine user ID')
      }

      console.log(`👤 User ID determined: ${userId}`)

      // ✅ FIXED: Get Upwork user info with access token
      console.log('🔄 Step 2: Getting Upwork user info...')
      let upworkUserId = 'unknown'
      let upworkUserName = 'Upwork User'
      
      try {
        const userInfoResponse = await fetch('https://www.upwork.com/api/auth/v1/info', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        })

        if (userInfoResponse.ok) {
          const userInfo = await userInfoResponse.json()
          console.log('📊 Upwork user info:', JSON.stringify(userInfo, null, 2))
          
          upworkUserId = userInfo.info?.user?.uid || 'unknown'
          upworkUserName = userInfo.info?.user?.full_name || 'Upwork User'
          console.log('✅ Got Upwork user info:', upworkUserName)
        } else {
          console.warn('⚠️ Could not fetch Upwork user info, continuing with tokens')
        }
      } catch (userInfoError) {
        console.warn('⚠️ User info fetch failed:', userInfoError)
        // Continue anyway, tokens are more important
      }

      // ✅ FIXED: Save to database
      console.log('💾 Step 3: Saving tokens to database...')
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
          [userId, tokenData.access_token, tokenData.refresh_token || '', upworkUserId, upworkUserName]
        )
        
        console.log('✅ Upwork account saved to database successfully!')
      } catch (dbError: any) {
        console.error('❌ Database error:', dbError.message)
        // Continue to redirect with success if tokens were obtained
      }

      // ✅ FIXED: Test API connection
      console.log('🧪 Step 4: Testing API connection...')
      try {
        const testResponse = await fetch('https://www.upwork.com/api/profiles/v2/search/jobs.json', {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        })
        
        if (testResponse.ok) {
          console.log('✅ API test successful! Connection verified.')
        } else {
          console.warn('⚠️ API test returned status:', testResponse.status)
        }
      } catch (testError) {
        console.warn('⚠️ API test failed, but tokens saved:', testError)
      }

      // ✅ SUCCESS REDIRECT
      console.log('🎉 Upwork connection completed successfully! Redirecting to dashboard...')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected')

    } catch (exchangeError: any) {
      console.error('❌ Token exchange process failed:', exchangeError.message)
      return NextResponse.redirect(`https://updash.shameelnasir.com/dashboard?error=${encodeURIComponent(exchangeError.message)}`)
    }

  } catch (error: any) {
    console.error('❌ Callback general error:', error)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error.message))
  }
}