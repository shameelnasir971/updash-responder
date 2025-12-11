//app/api/upwork/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ FUNCTION: Get Upwork User Info (Tenant ID) - FIXED METHOD
async function getUpworkUserInfo(accessToken: string) {
  try {
    console.log('🔍 Fetching Upwork user info for Tenant ID...')

    // ✅ CORRECT ENDPOINT for getting the authenticated user's info
    const endpoint = 'https://www.upwork.com/api/auth/v1/info'

    console.log(`Trying endpoint: ${endpoint}`)
    const response = await fetch(endpoint, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    console.log(`Response status: ${response.status}`)

    if (response.ok) {
      const data = await response.json()
      console.log('✅ User info response received')

      // ✅ The authenticated user's ID is in `info.user.uid`
      // According to Upwork's OAuth flow, this is the correct Tenant ID for GraphQL
      if (data.info && data.info.user && data.info.user.uid) {
        const tenantId = data.info.user.uid
        console.log('✅ Found REAL Tenant ID (user.uid):', tenantId)
        return tenantId
      } else {
        console.log('❌ Could not find user.uid in response structure:', data)
        return null
      }
    } else {
      const errorText = await response.text()
      console.log(`❌ User info endpoint failed: ${errorText.substring(0, 200)}`)
      return null
    }

  } catch (error: any) {
    console.error('❌ User info fetch error:', error.message)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    console.log('=== UPWORK CALLBACK START ===')

    if (error || !code) {
      console.error('❌ OAuth failed or no code received')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=OAuth+failed')
    }

    console.log('✅ Authorization code received')

    // Environment check
    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'

    if (!clientId || !clientSecret) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=Server+configuration+error')
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
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText.substring(0, 200))
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=Token+exchange+failed')
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange SUCCESSFUL!')

    // ✅ STEP 2: Get REAL Tenant ID (Upwork User ID)
    console.log('🔍 Getting REAL Tenant ID...')
    const tenantId = await getUpworkUserInfo(tokenData.access_token)

    if (!tenantId) {
      console.error('❌ CRITICAL: Could not get REAL Tenant ID. App permissions may be wrong.')
      // Save token anyway, but we'll use Marketplace API instead of GraphQL
      console.log('⚠️ Will fallback to Marketplace API only')
    } else {
      console.log('✅ REAL Tenant ID obtained:', tenantId)
    }

    // ✅ STEP 3: Save to database
    console.log('💾 Saving to database...')
    const users = await pool.query('SELECT id FROM users LIMIT 1')

    if (users.rows.length === 0) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=No+user+account+found')
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
      tenantId || null // Save tenantId if we got it
    ])

    console.log('✅ Connection saved successfully')
    console.log('=== UPWORK CALLBACK COMPLETE ===')

    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&message=Upwork+connected+successfully!')

  } catch (error: any) {
    console.error('❌ CALLBACK UNEXPECTED ERROR:', error.message)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(`Error: ${error.message}`))
  }
}