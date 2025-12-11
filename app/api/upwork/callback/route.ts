//app/api/upwork/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ SIMPLE FUNCTION: Get Tenant ID from JWT Token
function extractUserIdFromToken(accessToken: string): string | null {
  try {
    // Check if token is JWT format (has 3 parts separated by dots)
    if (accessToken.split('.').length === 3) {
      try {
        const payload = JSON.parse(
          Buffer.from(accessToken.split('.')[1], 'base64').toString()
        )
        
        // Try different possible fields for user ID
        if (payload.sub) return payload.sub
        if (payload.user_id) return payload.user_id
        if (payload.id) return payload.id
        if (payload.uid) return payload.uid
      } catch (e) {
        console.log('❌ Could not decode JWT')
      }
    }
    
    return null
  } catch (error) {
    console.error('Token extraction error:', error)
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
    console.log('🔑 Access token (first 30 chars):', tokenData.access_token.substring(0, 30) + '...')

    // ✅ STEP 3: Extract Tenant ID from token (JWT decode)
    console.log('🔍 Extracting Tenant ID from access token...')
    let tenantId = extractUserIdFromToken(tokenData.access_token)
    
    if (tenantId) {
      console.log('✅ Found Tenant ID in JWT:', tenantId)
    } else {
      console.log('⚠️ Could not extract Tenant ID from JWT')
      // Generate a stable ID from token
      const stableId = `upwork_${tokenData.access_token.substring(20, 40).replace(/[^a-zA-Z0-9]/g, '')}`
      console.log('✅ Using stable ID:', stableId)
      tenantId = stableId
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

    // ✅ STEP 5: Save to database
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