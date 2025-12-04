// app/api/upwork/callback/route.ts - WORKING VERSION
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')
    const error_description = searchParams.get('error_description')

    console.log('🔄 Upwork callback received:', { 
      code: code ? 'Present' : 'Missing',
      error,
      state: state?.substring(0, 30) + '...'
    })

    if (error) {
      console.error('❌ OAuth error from Upwork:', error_description || error)
      return NextResponse.redirect(
        new URL('/dashboard?error=upwork_oauth_failed&message=' + 
               encodeURIComponent(error_description || error), 
               process.env.NEXT_PUBLIC_APP_URL || 'https://updash.shameelnasir.com')
      )
    }

    if (!code) {
      console.error('❌ No authorization code received')
      return NextResponse.redirect(
        new URL('/dashboard?error=no_authorization_code', 
               process.env.NEXT_PUBLIC_APP_URL || 'https://updash.shameelnasir.com')
      )
    }

    // Extract user ID from state (format: hex_user_id_timestamp)
    const userId = state ? state.split('_')[2] : null
    if (!userId || isNaN(parseInt(userId))) {
      console.error('❌ Invalid or missing user ID in state:', state)
      return NextResponse.redirect(
        new URL('/dashboard?error=invalid_state_parameter', 
               process.env.NEXT_PUBLIC_APP_URL || 'https://updash.shameelnasir.com')
      )
    }

    const clientId = process.env.UPWORK_CLIENT_ID || "b2cf4bfa369cac47083f664358d3accb"
    const clientSecret = process.env.UPWORK_CLIENT_SECRET || "0146401c5c4fd338"
    
    // Multiple redirect URIs try karne ke liye
    const redirectUris = [
      process.env.UPWORK_REDIRECT_URI,
      "https://updash.shameelnasir.com/api/upwork/callback",
      "https://updash.shameelnasir.com/auth/upwork/callback"
    ]
    
    const redirectUri = redirectUris.find(uri => uri && uri.includes('upwork/callback')) || 
                       "https://updash.shameelnasir.com/api/upwork/callback"

    console.log('🔄 Exchanging code for access token...')
    console.log('Client ID:', clientId.substring(0, 10) + '...')
    console.log('Redirect URI:', redirectUri)

    // Exchange code for access token using URLSearchParams properly
    const tokenParams = new URLSearchParams()
    tokenParams.append('grant_type', 'authorization_code')
    tokenParams.append('code', code)
    tokenParams.append('redirect_uri', redirectUri)
    tokenParams.append('client_id', clientId)
    tokenParams.append('client_secret', clientSecret)

    const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: tokenParams
    })

    console.log('Token response status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText)
      
      // Try alternative method (Basic Auth)
      console.log('🔄 Trying Basic Auth method...')
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
      
      const altResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
          'Accept': 'application/json'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri
        })
      })
      
      if (!altResponse.ok) {
        const altError = await altResponse.text()
        console.error('❌ Alternative token exchange failed:', altError)
        return NextResponse.redirect(
          new URL('/dashboard?error=token_exchange_failed', 
                 process.env.NEXT_PUBLIC_APP_URL || 'https://updash.shameelnasir.com')
        )
      }
      
      const tokenData = await altResponse.json()
      await saveTokensToDB(parseInt(userId), tokenData)
      
      console.log('✅ Upwork account connected via Basic Auth!')
      return NextResponse.redirect(
        new URL('/dashboard?success=upwork_connected&method=basic_auth', 
               process.env.NEXT_PUBLIC_APP_URL || 'https://updash.shameelnasir.com')
      )
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful')
    console.log('Access token received:', tokenData.access_token ? 'Yes' : 'No')

    await saveTokensToDB(parseInt(userId), tokenData)

    console.log('✅ Upwork account connected successfully!')
    
    return NextResponse.redirect(
      new URL('/dashboard?success=upwork_connected&message=account_linked', 
             process.env.NEXT_PUBLIC_APP_URL || 'https://updash.shameelnasir.com')
    )

  } catch (error: any) {
    console.error('❌ Callback error:', error.message || error)
    return NextResponse.redirect(
      new URL(`/dashboard?error=callback_error&message=${encodeURIComponent(error.message || 'Unknown error')}`, 
             process.env.NEXT_PUBLIC_APP_URL || 'https://updash.shameelnasir.com')
    )
  }
}

async function saveTokensToDB(userId: number, tokenData: any) {
  try {
    // First ensure table exists
    await pool.query(`
      CREATE TABLE IF NOT EXISTS upwork_accounts (
        user_id INTEGER PRIMARY KEY,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        token_type TEXT,
        expires_in INTEGER,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT fk_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `)
    
    // Save tokens
    await pool.query(
      `INSERT INTO upwork_accounts 
       (user_id, access_token, refresh_token, token_type, expires_in, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         access_token = EXCLUDED.access_token,
         refresh_token = EXCLUDED.refresh_token,
         token_type = EXCLUDED.token_type,
         expires_in = EXCLUDED.expires_in,
         updated_at = NOW()`,
      [
        userId,
        tokenData.access_token,
        tokenData.refresh_token || null,
        tokenData.token_type || 'bearer',
        tokenData.expires_in || 86400
      ]
    )
    
    console.log('✅ Tokens saved to database for user:', userId)
  } catch (dbError: any) {
    console.error('❌ Database error:', dbError.message)
    throw dbError
  }
}