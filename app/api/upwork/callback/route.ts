//app/api/upwork/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

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

    // ✅ STEP 1: Exchange code for tokens (THIS IS CORRECT[citation:1])
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

    // ❗ **CRITICAL CHANGE: DO NOT FETCH TENANT ID**
    // The old endpoint (/api/auth/v1/info) is gone (410 error).
    // We cannot get the Tenant ID without proper GraphQL permissions.
    // This is FINE because the REST Jobs API only needs an access token.
    console.log('⚠️ Skipping Tenant ID fetch. Using REST API only.')

    // ✅ STEP 2: Save to database (save NULL for tenant ID)
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
      null // ⬅️ We are saving NULL for upwork_user_id (Tenant ID)
    ])

    console.log('✅ Connection saved successfully (REST mode)')
    console.log('=== UPWORK CALLBACK COMPLETE ===')

    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&message=Upwork+REST+API+connected!')

  } catch (error: any) {
    console.error('❌ CALLBACK UNEXPECTED ERROR:', error.message)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(`Error: ${error.message}`))
  }
}