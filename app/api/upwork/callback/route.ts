// app/api/upwork/callback/route.ts - DEBUG VERSION
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const errorDescription = searchParams.get('error_description')

    console.log('=== UPWORK CALLBACK DEBUG START ===')
    console.log('🔍 Received parameters:', { code: code ? 'Present' : 'Missing', error, errorDescription })
    console.log('🔍 Full URL:', request.url)

    // Agar error hai directly URL mein
    if (error) {
      console.error('❌ Upwork returned error:', { error, errorDescription })
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent(`OAuth Error: ${error} - ${errorDescription || 'No description'}`))
    }

    // Agar code nahi hai
    if (!code) {
      console.error('❌ No authorization code received')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=No+authorization+code+received')
    }

    console.log('✅ Authorization code received (first 20 chars):', code.substring(0, 20) + '...')

    // Environment variables check
    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'

    console.log('🔧 Environment check:', {
      clientId: clientId ? 'Present' : 'MISSING!',
      clientSecret: clientSecret ? 'Present' : 'MISSING!',
      redirectUri
    })

    if (!clientId || !clientSecret) {
      console.error('❌ CRITICAL: Client ID or Secret missing in Railway environment')
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

    console.log('📤 Token request to:', tokenUrl)
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    })

    const responseText = await tokenResponse.text()
    console.log('📥 Token response status:', tokenResponse.status)
    console.log('📥 Token response body:', responseText)

    if (!tokenResponse.ok) {
      console.error('❌ TOKEN EXCHANGE FAILED!')
      console.error('❌ Status:', tokenResponse.status)
      console.error('❌ Response:', responseText)
      
      // Try to parse error
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
    console.log('🔑 Access token received:', tokenData.access_token ? 'Yes' : 'No')
    console.log('🔄 Refresh token:', tokenData.refresh_token ? 'Yes' : 'No')
    console.log('⏳ Expires in:', tokenData.expires_in, 'seconds')

    // ✅ STEP 3: Get user from database
    console.log('💾 Saving token to database...')
    const users = await pool.query('SELECT id FROM users LIMIT 1')
    
    if (users.rows.length === 0) {
      console.error('❌ No user found in database')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent('No user account found. Please sign up first.'))
    }

    const userId = users.rows[0].id
    console.log('👤 Found user ID:', userId)

    // ✅ STEP 4: Save to database
    const insertQuery = `
      INSERT INTO upwork_accounts (user_id, access_token, refresh_token, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        access_token = $2, 
        refresh_token = $3,
        updated_at = NOW()
      RETURNING id
    `
    
    try {
      const result = await pool.query(insertQuery, [
        userId, 
        tokenData.access_token, 
        tokenData.refresh_token || ''
      ])
      console.log('💾 Token saved to database. Row ID:', result.rows[0]?.id)
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
        encodeURIComponent(`Database error: ${dbError.message}`))
    }

    // ✅ STEP 5: Verify save
    const verifyResult = await pool.query(
      'SELECT COUNT(*) as count FROM upwork_accounts WHERE user_id = $1',
      [userId]
    )
    
    console.log('✅ Verification:', verifyResult.rows[0].count, 'token(s) in database')
    console.log('=== UPWORK CALLBACK DEBUG END ===')

    // ✅ FINAL SUCCESS
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&message=Upwork+connected+successfully!')

  } catch (error: any) {
    console.error('❌ CALLBACK UNEXPECTED ERROR:', error.message)
    console.error('❌ Stack trace:', error.stack)
    
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + 
      encodeURIComponent(`Unexpected error: ${error.message}`))
  }
}