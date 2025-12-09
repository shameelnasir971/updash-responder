import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ FUNCTION: Get Upwork User Info (Tenant ID)
async function getUpworkUserInfo(accessToken: string) {
  try {
    console.log('🔍 Fetching Upwork user info...')
    
    // Try multiple endpoints
    const endpoints = [
      'https://www.upwork.com/api/auth/v1/info',
      'https://api.upwork.com/api/auth/v1/info',
      'https://www.upwork.com/api/hr/v2/users/me.json'
    ]
    
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log(`✅ User info from ${endpoint}:`, Object.keys(data))
          
          // Extract user ID from different formats
          if (data.id) return data.id
          if (data.user) return data.user.id
          if (data.profile) return data.profile.id
          if (data.user_id) return data.user_id
        }
      } catch (e) {
        console.log(`User info endpoint ${endpoint} failed`)
        continue
      }
    }
    
    return null
  } catch (error) {
    console.error('❌ User info fetch error:', error)
    return null
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

    // ✅ STEP 3: Get Tenant ID (Upwork User ID)
    console.log('🔍 Getting Tenant ID...')
    let tenantId = await getUpworkUserInfo(tokenData.access_token)
    
    if (!tenantId) {
      console.log('⚠️ Could not get Tenant ID, trying to extract from access token...')
      
      // Try to extract from JWT token (if it's JWT format)
      try {
        const tokenParts = tokenData.access_token.split('.')
        if (tokenParts.length === 3) {
          const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
          if (payload.sub) {
            console.log('✅ Got Tenant ID from JWT token:', payload.sub)
            tenantId = payload.sub
          }
        }
      } catch (jwtError) {
        console.log('❌ Could not extract Tenant ID from token')
      }
    }

    console.log('🔑 Tenant ID:', tenantId || 'NOT FOUND')

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
        tenantId || null
      ])
      console.log('💾 Token saved to database. Row ID:', result.rows[0]?.id)
      console.log('✅ Tenant ID saved:', tenantId ? 'YES' : 'NO')
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent(`Database error: ${dbError.message}`))
    }

    // ✅ STEP 6: Test connection immediately
    if (tenantId && tokenData.access_token) {
      console.log('🚀 Testing GraphQL connection...')
      try {
        const testQuery = { query: '{ __schema { queryType { name } } }' }
        
        const testResponse = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Content-Type': 'application/json',
            'X-Upwork-API-TenantId': tenantId
          },
          body: JSON.stringify(testQuery)
        })
        
        console.log('📊 GraphQL test status:', testResponse.status)
        if (testResponse.ok) {
          console.log('🎉 GraphQL API ACCESS SUCCESSFUL!')
        }
      } catch (testError) {
        console.log('⚠️ GraphQL test failed:', testError)
      }
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