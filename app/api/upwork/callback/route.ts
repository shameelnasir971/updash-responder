// app/api/upwork/callback/route.ts - WITH DEBUGGING
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    console.log('🔄 Upwork Callback DEBUG:', { 
      code: code ? 'Present' : 'Missing',
      error,
      state 
    })

    // Agar error hai
    if (error) {
      console.error('❌ Upwork authorization error:', error)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error))
    }

    // Agar code nahi hai
    if (!code) {
      console.error('❌ No authorization code')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=No+authorization+code')
    }

    console.log('✅ Authorization code received:', code.substring(0, 20) + '...')

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'

    console.log('🔧 Config check:', {
      clientId: clientId ? 'Present' : 'Missing',
      clientSecret: clientSecret ? 'Present' : 'Missing',
      redirectUri
    })

    if (!clientId || !clientSecret) {
      throw new Error('Upwork credentials not configured in Railway')
    }

    // ✅ Token Exchange Request
    const tokenUrl = 'https://www.upwork.com/api/v3/oauth2/token'
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    })

    console.log('🔄 Token exchange request to:', tokenUrl)
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params
    })

    const responseText = await tokenResponse.text()
    console.log('📊 Token response status:', tokenResponse.status)
    console.log('📊 Token response body:', responseText.substring(0, 300))

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${responseText}`)
    }

    const tokenData = JSON.parse(responseText)
    console.log('✅ Token exchange successful')
    console.log('🔑 Access token received:', tokenData.access_token ? 'Yes' : 'No')
    console.log('🔄 Refresh token:', tokenData.refresh_token ? 'Yes' : 'No')
    console.log('📅 Expires in:', tokenData.expires_in, 'seconds')

    // ✅ Get first user from database (since only boss is using)
    const users = await pool.query('SELECT id FROM users LIMIT 1')
    
    if (users.rows.length === 0) {
      throw new Error('No user found in database. Please sign up first.')
    }

    const userId = users.rows[0].id
    console.log('👤 User ID for token storage:', userId)

    // ✅ Save to database
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
    
    const result = await pool.query(insertQuery, [
      userId, 
      tokenData.access_token, 
      tokenData.refresh_token || ''
    ])

    console.log('💾 Token saved to database, row ID:', result.rows[0]?.id)

    // ✅ Verify token was saved
    const verifyQuery = await pool.query(
      'SELECT COUNT(*) as count FROM upwork_accounts WHERE user_id = $1',
      [userId]
    )
    
    console.log('✅ Token verification:', verifyQuery.rows[0].count, 'token(s) found')

    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&message=Upwork+connected+successfully')

  } catch (error: any) {
    console.error('❌ Callback error:', error.message)
    console.error('❌ Callback stack:', error.stack)
    
    return NextResponse.redirect(
      'https://updash.shameelnasir.com/dashboard?error=' + 
      encodeURIComponent(`Connection failed: ${error.message}`)
    )
  }
}