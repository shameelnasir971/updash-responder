// app/api/upwork/callback/route.ts - SIMPLE WORKING VERSION
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

    if (error) {
      console.error('❌ Upwork OAuth error:', error)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error))
    }

    if (!code) {
      console.error('❌ No authorization code')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_code')
    }

    console.log('✅ Got authorization code, exchanging for token...')

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'

    if (!clientId || !clientSecret) {
      console.error('❌ Missing Upwork credentials')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=missing_credentials')
    }

    // ✅ SIMPLE TOKEN EXCHANGE
    const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    })

    const tokenData = await tokenResponse.json()
    
    if (!tokenResponse.ok) {
      console.error('❌ Token exchange failed:', tokenData)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=token_exchange_failed')
    }

    console.log('✅ Token exchange successful')

    // ✅ GET USER ID (First user from database)
    const users = await pool.query('SELECT id FROM users ORDER BY id LIMIT 1')
    if (users.rows.length === 0) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_user_found')
    }

    const userId = users.rows[0].id

    // ✅ SAVE TOKENS
    await pool.query(
      `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         access_token = $2, 
         refresh_token = $3,
         updated_at = NOW()`,
      [userId, tokenData.access_token, tokenData.refresh_token || '']
    )

    console.log('✅ Upwork tokens saved for user:', userId)

    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected')

  } catch (error: any) {
    console.error('❌ Callback error:', error)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error.message))
  }
}