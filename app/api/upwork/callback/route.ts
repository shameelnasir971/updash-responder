// app/api/upwork/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Get Tenant ID from GraphQL user query
async function getTenantId(accessToken: string) {
  try {
    console.log('🔍 Getting Tenant ID from user query...')
    
    // Simple user query - SCHEMA KE MUTABIQ
    const userQuery = {
      query: `{
        user {
          id
          nid
          email
          name
        }
      }`
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(userQuery)
    })
    
    console.log('📥 User query response status:', response.status)
    
    if (response.ok) {
      const data = await response.json()
      console.log('📋 User query response:', JSON.stringify(data).substring(0, 300))
      
      // Check for errors first
      if (data.errors) {
        console.error('❌ User query errors:', data.errors)
        
        // Try alternative: get user ID from JWT token
        try {
          const tokenParts = accessToken.split('.')
          if (tokenParts.length === 3) {
            const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
            console.log('🎫 JWT payload extracted')
            
            // Try different possible user ID fields
            const userId = payload.sub || payload.user_id || payload.client_id || payload.uid
            if (userId) {
              console.log('✅ Got user ID from JWT:', userId.substring(0, 20) + '...')
              return userId
            }
          }
        } catch (jwtError) {
          console.log('JWT decode failed, using fallback')
        }
        
        return `fallback_${Date.now()}`
      }
      
      // Extract user ID from successful response
      if (data.data?.user?.id) {
        console.log('✅ Got Tenant ID from user query:', data.data.user.id.substring(0, 20) + '...')
        return data.data.user.id
      }
      
      if (data.data?.user?.nid) {
        console.log('✅ Got Tenant ID from nid:', data.data.user.nid)
        return data.data.user.nid
      }
    }
    
    console.log('⚠️ Could not get Tenant ID, using fallback')
    return `fallback_${Date.now()}`
    
  } catch (error: any) {
    console.error('❌ Tenant ID fetch error:', error.message)
    return `error_${Date.now()}`
  }
}

// ✅ Check if user exists in database
async function getOrCreateUser() {
  try {
    console.log('👤 Checking for existing user...')
    
    // Check if any user exists
    const usersResult = await pool.query('SELECT id FROM users LIMIT 1')
    
    if (usersResult.rows.length === 0) {
      console.log('⚠️ No user found in database, creating default...')
      
      // Create a default user if none exists
      const defaultUser = await pool.query(
        `INSERT INTO users (name, email, password, company_name, created_at) 
         VALUES ($1, $2, $3, $4, NOW()) 
         RETURNING id`,
        ['Default User', 'default@example.com', 'hashed_password', 'Default Company']
      )
      
      console.log('✅ Created default user with ID:', defaultUser.rows[0].id)
      return defaultUser.rows[0].id
    }
    
    console.log('✅ Found existing user ID:', usersResult.rows[0].id)
    return usersResult.rows[0].id
    
  } catch (error: any) {
    console.error('❌ User check error:', error.message)
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    
    console.log('=== UPWORK CALLBACK STARTED ===')
    console.log('📝 Code:', code ? 'Present' : 'Missing')
    console.log('❌ Error param:', error || 'None')
    
    // Handle OAuth errors
    if (error) {
      console.error('❌ Upwork OAuth error:', error)
      return NextResponse.redirect('https://updash.shameelnasir.com/auth/login?error=' + encodeURIComponent(`Upwork auth failed: ${error}`))
    }
    
    if (!code) {
      console.error('❌ No authorization code provided')
      return NextResponse.redirect('https://updash.shameelnasir.com/auth/login?error=No+authorization+code')
    }
    
    // Environment variables check
    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = process.env.UPWORK_REDIRECT_URI || 'https://updash.shameelnasir.com/api/upwork/callback'
    
    if (!clientId || !clientSecret) {
      console.error('❌ Missing Upwork credentials:')
      console.error('Client ID:', clientId ? 'Present' : 'Missing')
      console.error('Client Secret:', clientSecret ? 'Present' : 'Missing')
      
      return NextResponse.redirect('https://updash.shameelnasir.com/auth/login?error=Upwork+API+not+configured')
    }
    
    console.log('✅ Environment check passed')
    
    // 1. Exchange authorization code for tokens
    console.log('🔄 Exchanging code for tokens...')
    
    const tokenUrl = 'https://www.upwork.com/api/v3/oauth2/token'
    
    const tokenParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    })
    
    console.log('📤 Token endpoint:', tokenUrl)
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams
    })
    
    console.log('📥 Token response status:', tokenResponse.status)
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText)
      return NextResponse.redirect('https://updash.shameelnasir.com/auth/login?error=Token+exchange+failed')
    }
    
    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful')
    console.log('🔑 Access token length:', tokenData.access_token?.length || 0)
    console.log('🔄 Refresh token:', tokenData.refresh_token ? 'Present' : 'Missing')
    console.log('⏰ Expires in:', tokenData.expires_in || 'Unknown', 'seconds')
    
    if (!tokenData.access_token) {
      console.error('❌ No access token in response')
      return NextResponse.redirect('https://updash.shameelnasir.com/auth/login?error=No+access+token+received')
    }
    
    // 2. Get Tenant ID
    const tenantId = await getTenantId(tokenData.access_token)
    console.log('🏷️ Final Tenant ID:', tenantId)
    
    // 3. Get or create user in database
    const userId = await getOrCreateUser()
    
    // 4. Save tokens to database
    console.log('💾 Saving tokens to database...')
    
    // Calculate token expiration
    const expiresAt = tokenData.expires_in 
      ? new Date(Date.now() + (tokenData.expires_in * 1000))
      : new Date(Date.now() + (3600 * 1000)) // Default 1 hour
    
    const insertQuery = `
      INSERT INTO upwork_accounts (
        user_id, 
        access_token, 
        refresh_token, 
        upwork_user_id, 
        token_expires_at,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        upwork_user_id = EXCLUDED.upwork_user_id,
        token_expires_at = EXCLUDED.token_expires_at,
        updated_at = NOW()
      RETURNING id
    `
    
    const insertParams = [
      userId,
      tokenData.access_token,
      tokenData.refresh_token || '',
      tenantId,
      expiresAt
    ]
    
    const dbResult = await pool.query(insertQuery, insertParams)
    console.log('✅ Database updated, record ID:', dbResult.rows[0]?.id)
    
    // 5. Test the connection with a simple query
    console.log('🧪 Testing connection with simple query...')
    
    try {
      const testQuery = {
        query: `{ user { id } }`
      }
      
      const testResponse = await fetch('https://api.upwork.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(testQuery)
      })
      
      if (testResponse.ok) {
        const testData = await testResponse.json()
        console.log('✅ Connection test passed:', testData.data ? 'User data received' : 'No data')
      } else {
        console.log('⚠️ Connection test failed, but proceeding anyway')
      }
    } catch (testError) {
      console.log('⚠️ Connection test error (non-critical):', testError)
    }
    
    console.log('✅✅✅ UPWORK CALLBACK COMPLETED SUCCESSFULLY ✅✅✅')
    
    // Redirect to dashboard with success
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=true&message=Upwork+connected+successfully!')
    
  } catch (error: any) {
    console.error('❌❌❌ CALLBACK FATAL ERROR ❌❌❌')
    console.error('Error:', error.message)
    console.error('Stack:', error.stack)
    
    // Redirect to login with error
    return NextResponse.redirect(
      `https://updash.shameelnasir.com/auth/login?error=${encodeURIComponent(
        `Connection failed: ${error.message || 'Unknown error'}`
      )}`
    )
  }
}

// ✅ POST method for direct token exchange (if needed)
export async function POST(request: NextRequest) {
  try {
    console.log('📨 POST callback received')
    
    const body = await request.json()
    const { code } = body
    
    if (!code) {
      return NextResponse.json({ 
        success: false, 
        error: 'Authorization code required' 
      }, { status: 400 })
    }
    
    // Reuse the GET logic but return JSON
    const { searchParams } = new URL(request.url)
    const url = new URL('https://updash.shameelnasir.com/api/upwork/callback')
    url.searchParams.set('code', code)
    
    // Call GET internally
    const getResponse = await GET(new NextRequest(url.toString()))
    
    // Since GET redirects, we need to handle differently
    return NextResponse.json({
      success: true,
      message: 'Token exchange initiated',
      redirect: true
    })
    
  } catch (error: any) {
    console.error('POST callback error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}