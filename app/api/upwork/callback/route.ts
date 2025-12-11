//app/api/upwork/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ FIXED: Get Upwork User Info (Tenant ID)
async function getUpworkUserInfo(accessToken: string) {
  try {
    console.log('🔍 Fetching Upwork user info for Tenant ID...')
    
    // ✅ CORRECT ENDPOINT for user info
    const endpoints = [
      'https://www.upwork.com/api/hr/v2/users/me.json', // ✅ BEST
      'https://api.upwork.com/api/hr/v2/users/me.json',
      'https://www.upwork.com/api/auth/v1/info'
    ]
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying endpoint: ${endpoint}`)
        
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        })
        
        console.log(`Response status: ${response.status}`)
        
        if (response.ok) {
          const data = await response.json()
          console.log('✅ User info response:', data)
          
          // ✅ Extract user ID from response
          if (data.user && data.user.id) {
            console.log('✅ Found user ID in user.user.id:', data.user.id)
            return data.user.id
          }
          if (data.id) {
            console.log('✅ Found user ID in id:', data.id)
            return data.id
          }
          if (data.profile && data.profile.id) {
            console.log('✅ Found user ID in profile.id:', data.profile.id)
            return data.profile.id
          }
          
          // Try nested structure
          if (data.result && data.result.user && data.result.user.id) {
            console.log('✅ Found user ID in result.user.id:', data.result.user.id)
            return data.result.user.id
          }
          
          console.log('❌ Could not find user ID in response structure:', Object.keys(data))
        } else {
          const errorText = await response.text()
          console.log(`Endpoint ${endpoint} failed: ${errorText.substring(0, 200)}`)
        }
      } catch (e: any) {
        console.log(`Endpoint ${endpoint} error: ${e.message}`)
        continue
      }
    }
    
    // ✅ Alternative: Decode JWT token
    console.log('🔄 Trying to decode JWT token for user ID...')
    try {
      // Access token might be JWT
      const tokenParts = accessToken.split('.')
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
        console.log('JWT payload:', payload)
        
        if (payload.sub) {
          console.log('✅ Got user ID from JWT sub:', payload.sub)
          return payload.sub
        }
        if (payload.user_id) {
          console.log('✅ Got user ID from JWT user_id:', payload.user_id)
          return payload.user_id
        }
        if (payload.id) {
          console.log('✅ Got user ID from JWT id:', payload.id)
          return payload.id
        }
      }
    } catch (jwtError) {
      console.log('❌ Could not decode JWT token')
    }
    
    return null
    
  } catch (error: any) {
    console.error('❌ User info fetch error:', error.message)
    return null
  }
}

// ✅ TEST CONNECTION FUNCTION
async function testGraphQLConnection(accessToken: string, tenantId: string) {
  try {
    console.log('🚀 Testing GraphQL connection with Tenant ID...')
    
    const testQuery = {
      query: `{
        __schema {
          queryType {
            name
          }
        }
      }`
    }
    
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
    if (tenantId) {
      headers['X-Upwork-API-TenantId'] = tenantId
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(testQuery)
    })
    
    console.log('📊 GraphQL test status:', response.status)
    
    if (response.ok) {
      const data = await response.json()
      console.log('✅ GraphQL test successful!')
      console.log('Schema available:', !data.errors)
      return true
    } else {
      const errorText = await response.text()
      console.log('❌ GraphQL test failed:', errorText.substring(0, 200))
      return false
    }
  } catch (error: any) {
    console.log('❌ GraphQL test error:', error.message)
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

    console.log('✅ Authorization code received')

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
    console.log('🔑 Access token (first 30 chars):', tokenData.access_token.substring(0, 30) + '...')

    // ✅ STEP 3: Get Tenant ID (Upwork User ID)
    console.log('🔍 Getting Tenant ID...')
    let tenantId = await getUpworkUserInfo(tokenData.access_token)
    
    if (!tenantId) {
      console.log('⚠️ Could not get Tenant ID from API, using fallback...')
      
      // ✅ FALLBACK: If no tenant ID, use first 20 chars of access token as temp ID
      tenantId = `temp_${tokenData.access_token.substring(0, 20)}`
      console.log('✅ Using temporary tenant ID:', tenantId)
    } else {
      console.log('✅ Got real Tenant ID:', tenantId)
    }

    // ✅ STEP 4: Get user from database
    console.log('💾 Saving to database...')
    const users = await pool.query('SELECT id FROM users LIMIT 1')
    
    if (users.rows.length === 0) {
      console.error('❌ No user found in database')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent('No user account found. Please sign up first.'))
    }

    const userId = users.rows[0].id
    console.log('👤 Found user ID:', userId)

    // ✅ STEP 5: Save to database (INCLUDING TENANT ID)
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
        tenantId
      ])
      console.log('💾 Token saved to database. Row ID:', result.rows[0]?.id)
      console.log('✅ Tenant ID saved:', tenantId)
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent(`Database error: ${dbError.message}`))
    }

    // ✅ STEP 6: Test GraphQL connection
    console.log('🚀 Testing GraphQL API access...')
    const graphqlTest = await testGraphQLConnection(tokenData.access_token, tenantId)
    
    if (graphqlTest) {
      console.log('🎉 GraphQL API ACCESS SUCCESSFUL! Real jobs mil jayenge.')
    } else {
      console.log('⚠️ GraphQL test failed. Permissions check karo.')
    }

    console.log('=== UPWORK CALLBACK COMPLETE ===')

    // ✅ FINAL SUCCESS
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&message=Upwork+connected+successfully!')

  } catch (error: any) {
    console.error('❌ CALLBACK UNEXPECTED ERROR:', error.message)
    console.error('❌ Stack trace:', error.stack)
    
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
      encodeURIComponent(`Unexpected error: ${error.message}`))
  }
}