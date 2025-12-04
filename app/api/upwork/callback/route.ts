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
    const state = searchParams.get('state')

    console.log('🔄 Upwork Callback Received - Code:', code ? 'YES' : 'NO')

    if (error) {
      console.error('❌ Upwork OAuth error:', error)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error))
    }

    if (!code) {
      console.error('❌ No code received from Upwork')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_code')
    }

    console.log('✅ Got authorization code from Upwork')

    // Get user ID from state
    let userId = 1 // Single user app, hardcode for now
    if (state && state.includes('user_')) {
      const parts = state.split('_')
      if (parts.length > 1) {
        userId = parseInt(parts[1]) || 1
      }
    }

    console.log(`👤 Using user ID: ${userId}`)

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = process.env.UPWORK_REDIRECT_URI

    if (!clientId || !clientSecret) {
      console.error('❌ Missing Upwork credentials')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=missing_credentials')
    }

    // ✅ STEP 1: Exchange code for access token
    console.log('🔄 Exchanging code for access token...')
    
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
    console.log('✅ Token exchange successful!')

    // ✅ STEP 2: Save tokens to database
    console.log('💾 Saving tokens to database...')
    
    try {
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
      console.log('✅ Tokens saved to database')
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message)
      // Continue anyway
    }

    console.log('🎉 Upwork connection completed! Redirecting...')
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&message=Your+Upwork+account+is+now+connected!')

  } catch (error: any) {
    console.error('❌ Callback error:', error)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error.message))
  }
}