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

    console.log('🔄 Upwork callback received:')
    console.log('📝 Code:', code ? 'Present' : 'Missing')
    console.log('⚠️ Error:', error)
    console.log('🎯 State:', state)

    if (error) {
      console.error('❌ OAuth error from Upwork:', error)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=oauth_failed&message=' + encodeURIComponent(error))
    }

    if (!code) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_authorization_code')
    }

    // Extract user ID from state
    const userId = state ? state.split('_')[1] : null
    if (!userId) {
      console.error('❌ Invalid state parameter:', state)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=invalid_user_state')
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'

    if (!clientId || !clientSecret) {
      console.error('❌ Missing Upwork credentials in .env file')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=oauth_not_configured')
    }

    console.log('🔄 Exchanging code for access token...')
    console.log('🔑 Client ID:', clientId)
    console.log('📍 Redirect URI:', redirectUri)

    // ✅ CORRECT TOKEN EXCHANGE FOR SINGLE USER APP
    // Token exchange part update karein:
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
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret
  })
})

    console.log('📡 Token response status:', tokenResponse.status)
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=token_exchange_failed')
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful')
    console.log('🔑 Access token:', tokenData.access_token ? 'Present' : 'Missing')
    console.log('🔄 Refresh token:', tokenData.refresh_token ? 'Present' : 'Missing')
    console.log('⏰ Expires in:', tokenData.expires_in, 'seconds')

    // ✅ GET USER INFO FROM UPWORK
    console.log('🔄 Getting Upwork user info...')
    
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
        console.log('✅ User info:', userInfo)
        
        upworkUserId = userInfo.info?.user?.uid || 'unknown'
        upworkUserName = userInfo.info?.user?.full_name || 'Upwork User'
        console.log('👤 Upwork User:', upworkUserName, 'ID:', upworkUserId)
      } else {
        console.log('⚠️ Could not fetch user info, using defaults')
      }
    } catch (userInfoError) {
      console.log('⚠️ User info fetch failed, continuing...')
    }

    // ✅ SAVE TOKENS TO DATABASE
    console.log('💾 Saving tokens to database for user ID:', userId)
    
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
      
      // ✅ IMMEDIATELY TEST API CONNECTION
      console.log('🧪 Testing API connection by fetching a few jobs...')
      try {
        const testResponse = await fetch(
          `https://www.upwork.com/api/profiles/v2/search/jobs.json?q=web+development&paging=0;10`,
          {
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Accept': 'application/json'
            }
          }
        )
        
        if (testResponse.ok) {
          const testData = await testResponse.json()
          console.log(`✅ API test successful! Found ${testData.jobs?.length || 0} jobs`)
        } else {
          console.log('⚠️ API test failed, but tokens are saved')
        }
      } catch (testError) {
        console.log('⚠️ API test error, but connection is saved:', testError)
      }
      
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=database_save_failed')
    }

    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&message=Your+Upwork+account+is+now+connected!')

  } catch (error: any) {
    console.error('❌ Callback error:', error)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=callback_failed&message=' + encodeURIComponent(error.message))
  }
}

// ✅ SIMPLE JOB FETCH FOR TESTING
async function fetchSimpleUpworkJobs(accessToken: string) {
  try {
    const response = await fetch(
      `https://www.upwork.com/api/profiles/v2/search/jobs.json?q=web+development&paging=0;10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    const jobs = data.jobs || []
    
    return jobs.map((job: any) => ({
      id: job.id || `job_${Date.now()}`,
      title: job.title || 'Untitled Job',
      description: job.description || '',
      budget: job.budget ? 
        `${job.budget.amount} ${job.budget.currency}` : 
        'Not specified',
      postedDate: job.created_on ? 
        new Date(job.created_on).toLocaleString() : 
        'Recently',
      client: {
        name: job.client?.name || 'Client',
        rating: job.client?.feedback || 0,
        country: job.client?.country || 'Not specified'
      },
      skills: job.skills || [],
      proposals: job.proposals || 0,
      verified: job.verified || false,
      category: job.category2 || 'Web Development',
      source: 'upwork'
    }))

  } catch (error) {
    console.error('❌ Job fetch error:', error)
    throw error
  }
}