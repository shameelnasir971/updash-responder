import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ FUNCTION: Extract User ID/Tenant ID from Access Token
function extractUserIdFromToken(accessToken: string): string | null {
  try {
    console.log('🔍 Extracting user info from access token...')
    
    // Upwork access token format: oauth2v2_xxxxxxxxxxxx
    // Try to extract user ID from token structure
    const tokenParts = accessToken.split('_')
    
    if (tokenParts.length >= 3) {
      // The format might be: oauth2v2_{user_id}_{random}
      const potentialUserId = tokenParts[1]
      if (potentialUserId && potentialUserId.length > 10) {
        console.log('✅ Extracted user ID from token format:', potentialUserId.substring(0, 15) + '...')
        return potentialUserId
      }
    }
    
    // If above fails, try to use the whole token (first 30 chars) as identifier
    console.log('⚠️ Using first 30 chars of token as user identifier')
    return accessToken.substring(0, 30)
    
  } catch (error) {
    console.error('❌ Error extracting user ID:', error)
    return null
  }
}

// ✅ FUNCTION: Test API Access
async function testApiAccess(accessToken: string) {
  try {
    console.log('🧪 Testing API access with token...')
    
    // Test with REST API first (doesn't need tenant ID)
    const testEndpoints = [
      'https://www.upwork.com/api/profiles/v2/jobs/search.json?q=test&limit=1',
      'https://api.upwork.com/api/profiles/v2/jobs/search.json?q=test&limit=1'
    ]
    
    for (const endpoint of testEndpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        })
        
        if (response.ok) {
          console.log(`✅ API test successful with ${endpoint}`)
          return true
        }
      } catch (error) {
        console.log(`❌ API test failed for ${endpoint}`)
        continue
      }
    }
    
    return false
    
  } catch (error) {
    console.error('❌ API test error:', error)
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    console.log('=== UPWORK CALLBACK START ===')
    console.log('🔍 Code received:', code ? 'YES' : 'NO')
    console.log('🔍 Full callback URL:', request.url)

    // Check for errors
    if (error) {
      console.error('❌ Upwork OAuth error:', { error, errorDescription })
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent(`OAuth Error: ${error} - ${errorDescription || 'No description'}`))
    }

    if (!code) {
      console.error('❌ No authorization code received')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=No+authorization+code+received')
    }

    // Environment check
    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'

    if (!clientId || !clientSecret) {
      console.error('❌ CRITICAL: Client ID or Secret missing')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent('Server configuration error: API credentials missing'))
    }

    // ✅ STEP 1: Exchange code for tokens
    console.log('🔄 Exchanging code for access token...')
    const tokenUrl = 'https://www.upwork.com/api/v3/oauth2/token'
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    })

    console.log('📤 Sending token request...')
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    })

    const responseText = await tokenResponse.text()
    console.log('📥 Token response status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      console.error('❌ TOKEN EXCHANGE FAILED!')
      console.error('❌ Response:', responseText.substring(0, 200))
      
      let errorMsg = 'Token exchange failed'
      try {
        const errorData = JSON.parse(responseText)
        errorMsg = errorData.error || errorData.message || responseText.substring(0, 100)
      } catch (e) {
        errorMsg = responseText.substring(0, 100)
      }
      
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent(`Token error: ${errorMsg}`))
    }

    // ✅ STEP 2: Parse successful response
    const tokenData = JSON.parse(responseText)
    console.log('✅ Token exchange SUCCESSFUL!')
    console.log('🔑 Access token preview:', tokenData.access_token.substring(0, 30) + '...')
    console.log('🔄 Refresh token:', tokenData.refresh_token ? 'YES' : 'NO')
    console.log('⏳ Expires in:', tokenData.expires_in, 'seconds')

    // ✅ STEP 3: Extract User ID from token
    const upworkUserId = extractUserIdFromToken(tokenData.access_token)
    console.log('👤 Upwork User ID:', upworkUserId || 'Not extracted')

    // ✅ STEP 4: Test API access immediately
    const apiAccess = await testApiAccess(tokenData.access_token)
    console.log('📡 API Access Test:', apiAccess ? '✅ SUCCESS' : '❌ FAILED')

    // ✅ STEP 5: Get user from database
    console.log('💾 Saving to database...')
    const users = await pool.query('SELECT id FROM users LIMIT 1')
    
    if (users.rows.length === 0) {
      console.error('❌ No user found in database')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent('No user account found. Please sign up first.'))
    }

    const userId = users.rows[0].id
    console.log('👤 Found app user ID:', userId)

    // ✅ STEP 6: Save to database
    const insertQuery = `
      INSERT INTO upwork_accounts (user_id, access_token, refresh_token, upwork_user_id, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        access_token = $2, 
        refresh_token = $3,
        upwork_user_id = $4,
        updated_at = NOW()
      RETURNING id
    `
    
    try {
      const result = await pool.query(insertQuery, [
        userId, 
        tokenData.access_token, 
        tokenData.refresh_token || '',
        upworkUserId || tokenData.access_token.substring(0, 30) // Use token first 30 chars if no user ID
      ])
      console.log('💾 Token saved to database. Row ID:', result.rows[0]?.id)
      console.log('✅ API Access:', apiAccess ? 'Ready' : 'May have issues')
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent(`Database error: ${dbError.message}`))
    }

    console.log('=== UPWORK CALLBACK COMPLETE ===')

    // ✅ FINAL SUCCESS REDIRECT
    if (apiAccess) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&message=Upwork+connected+successfully!+You+can+now+load+jobs.')
    } else {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&message=Upwork+connected+but+API+access+may+be+limited.+Please+check+permissions.')
    }

  } catch (error: any) {
    console.error('❌ CALLBACK UNEXPECTED ERROR:', error.message)
    console.error('❌ Stack trace:', error.stack)
    
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
      encodeURIComponent(`Unexpected error: ${error.message}`))
  }
}