//app/api/upwork/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ ALTERNATE METHOD: Get Tenant ID using different query
async function getTenantIdAlternate(accessToken: string) {
  try {
    console.log('🔍 Getting Tenant ID (Alternate method)...')
    
    // Try different GraphQL queries to find current user
    const queries = [
      // Query 1: Try 'currentUser' instead of 'me'
      {
        query: `
          query GetCurrentUser {
            currentUser {
              id
              displayName
            }
          }
        `
      },
      // Query 2: Try 'viewer' (common in GraphQL)
      {
        query: `
          query GetViewer {
            viewer {
              id
              name
            }
          }
        `
      },
      // Query 3: Try user query with hardcoded ID (might work)
      {
        query: `
          query GetUser {
            user(id: "self") {
              id
              displayName
            }
          }
        `
      }
    ]
    
    for (const queryObj of queries) {
      try {
        console.log(`Trying query: ${queryObj.query.substring(0, 50)}...`)
        
        const response = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(queryObj)
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log('Query response:', JSON.stringify(data).substring(0, 200))
          
          // Check different response structures
          if (data.data?.currentUser?.id) {
            console.log('✅ Found Tenant ID in currentUser.id:', data.data.currentUser.id)
            return data.data.currentUser.id
          }
          if (data.data?.viewer?.id) {
            console.log('✅ Found Tenant ID in viewer.id:', data.data.viewer.id)
            return data.data.viewer.id
          }
          if (data.data?.user?.id) {
            console.log('✅ Found Tenant ID in user.id:', data.data.user.id)
            return data.data.user.id
          }
        }
      } catch (error) {
        console.log('Query failed, trying next...')
        continue
      }
    }
    
    // ✅ LAST RESORT: Extract from JWT token
    console.log('🔄 Trying to extract from JWT token...')
    try {
      // Access token is JWT format: xxxxx.yyyyy.zzzzz
      const tokenParts = accessToken.split('.')
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
        console.log('JWT payload keys:', Object.keys(payload))
        
        // Look for user ID in JWT claims
        if (payload.sub) {
          console.log('✅ Found sub in JWT:', payload.sub)
          return payload.sub
        }
        if (payload.user_id) {
          console.log('✅ Found user_id in JWT:', payload.user_id)
          return payload.user_id
        }
        if (payload.uid) {
          console.log('✅ Found uid in JWT:', payload.uid)
          return payload.uid
        }
      }
    } catch (jwtError) {
      console.log('Could not decode JWT')
    }
    
    return null
    
  } catch (error) {
    console.error('❌ Alternate method error:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    if (!code) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=No+code')
    }
    
    console.log('=== UPWORK CALLBACK START (FINAL) ===')
    
    // Environment variables
    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'
    
    if (!clientId || !clientSecret) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=Config+missing')
    }
    
    // 1. Exchange code for token
    console.log('🔄 Exchanging code for token...')
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=Token+failed')
    }
    
    const tokenData = await tokenResponse.json()
    console.log('✅ Token received')
    
    // 2. Get Tenant ID using alternate method
    const tenantId = await getTenantIdAlternate(tokenData.access_token)
    
    if (tenantId) {
      console.log('🎉 SUCCESS: Got Tenant ID:', tenantId)
    } else {
      console.log('⚠️ WARNING: Could not get Tenant ID')
      // We'll still save the token and try without Tenant ID
    }
    
    // 3. Save to database (CRITICAL - SAVE TENANT ID IF WE HAVE IT)
    console.log('💾 Saving to database...')
    const users = await pool.query('SELECT id FROM users LIMIT 1')
    
    if (users.rows.length === 0) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=No+user')
    }
    
    const userId = users.rows[0].id
    
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
    
    await pool.query(insertQuery, [
      userId,
      tokenData.access_token,
      tokenData.refresh_token || '',
      tenantId || '' // Save Tenant ID if we have it
    ])
    
    console.log('✅ Database updated with Tenant ID:', tenantId ? 'YES' : 'NO')
    console.log('=== UPWORK CALLBACK COMPLETE ===')
    
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=true&message=Upwork+connected!')
    
  } catch (error: any) {
    console.error('❌ Callback error:', error.message)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error.message))
  }
}