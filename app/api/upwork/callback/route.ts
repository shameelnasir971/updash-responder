//app/api/upwork/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ FUNCTION: Get Tenant ID from GraphQL
async function getTenantIdFromGraphQL(accessToken: string) {
  try {
    console.log('🔍 Getting Tenant ID via GraphQL...')
    
    // GraphQL query to get current user ID
    const query = {
      query: `
        query GetMyInfo {
          me {
            id
            displayName
          }
        }
      `
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(query)
    })
    
    if (!response.ok) {
      console.log(`❌ GraphQL status: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    console.log('📊 GraphQL response:', data)
    
    // Extract user ID from response
    if (data.data?.me?.id) {
      const tenantId = data.data.me.id
      console.log('✅ Found Tenant ID:', tenantId)
      return tenantId
    }
    
    return null
    
  } catch (error) {
    console.error('❌ GraphQL error:', error)
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
    
    console.log('=== UPWORK CALLBACK START ===')
    
    // Environment variables
    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'
    
    if (!clientId || !clientSecret) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=Config+missing')
    }
    
    // ✅ 1. Exchange code for token
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
    
    // ✅ 2. Get Tenant ID via GraphQL (IMPORTANT!)
    const tenantId = await getTenantIdFromGraphQL(tokenData.access_token)
    
    if (!tenantId) {
      console.log('⚠️ Could not get Tenant ID, will try without it')
    }
    
    // ✅ 3. Save to database
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
      tenantId // Save the Tenant ID
    ])
    
    console.log('✅ Database updated')
    console.log('=== UPWORK CALLBACK COMPLETE ===')
    
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=true&message=Upwork+connected!')
    
  } catch (error: any) {
    console.error('❌ Callback error:', error.message)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error.message))
  }
}