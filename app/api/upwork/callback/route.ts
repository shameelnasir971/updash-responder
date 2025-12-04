// app/api/upwork/callback/route.ts - COMPLETELY UPDATED
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    
    console.log('🔄 Upwork Callback Received')
    console.log('📥 Code present:', !!code)
    console.log('❌ Error present:', error)

    if (error) {
      console.error('Upwork OAuth Error:', error)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=upwork_auth_failed')
    }

    if (!code) {
      console.error('No code received')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_auth_code')
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = process.env.UPWORK_REDIRECT_URI

    if (!clientId || !clientSecret) {
      console.error('Missing Upwork credentials')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=missing_credentials')
    }

    console.log('🔄 Exchanging code for access token...')

    // 1. TOKEN EXCHANGE
    const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri || 'https://updash.shameelnasir.com/api/upwork/callback'
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', tokenResponse.status, errorText)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=token_exchange_failed')
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Access token received')

    // 2. GET USER ID (SIMPLE METHOD - ONLY ONE USER)
    const userResult = await pool.query('SELECT id FROM users LIMIT 1')
    if (userResult.rows.length === 0) {
      console.error('No users found in database')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_user_found')
    }

    const userId = userResult.rows[0].id
    console.log(`👤 Using user ID: ${userId}`)

    // 3. SAVE TOKENS TO DATABASE
    try {
      await pool.query(`
        INSERT INTO upwork_accounts (user_id, access_token, refresh_token, created_at)
        VALUES ($1, $2, $3, NOW())
        ON CONFLICT (user_id) 
        DO UPDATE SET 
          access_token = $2,
          refresh_token = $3,
          updated_at = NOW()
      `, [
        userId,
        tokenData.access_token,
        tokenData.refresh_token || ''
      ])
      
      console.log('✅ Tokens saved to database successfully')
    } catch (dbError: any) {
      console.error('Database error:', dbError.message)
      // Continue anyway
    }

    // 4. SUCCESS REDIRECT
    console.log('🎉 Upwork connection successful!')
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected')

  } catch (error: any) {
    console.error('❌ Callback error:', error.message)
    return NextResponse.redirect(`https://updash.shameelnasir.com/dashboard?error=${encodeURIComponent(error.message)}`)
  }
}