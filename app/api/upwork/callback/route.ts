// app/api/upwork/callback/route.ts - FINAL VERSION WITH TEST
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

    console.log('🔄 Upwork Callback received:', { hasCode: !!code, error, state })

    if (error) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error))
    }

    if (!code) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=No authorization code')
    }

    console.log('✅ Authorization code received, exchanging for token...')

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'

    if (!clientId || !clientSecret) {
      throw new Error('Upwork credentials not configured')
    }

    // ✅ Token Exchange
    const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: clientId,
        client_secret: clientSecret,
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', tokenResponse.status, errorText)
      throw new Error(`Token exchange failed: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful')
    
    // ✅ Get user ID from state or first user
    let userId: number
    
    if (state) {
      try {
        userId = parseInt(Buffer.from(state, 'base64').toString())
      } catch {
        const users = await pool.query('SELECT id FROM users LIMIT 1')
        userId = users.rows[0]?.id
      }
    } else {
      const users = await pool.query('SELECT id FROM users LIMIT 1')
      userId = users.rows[0]?.id
    }

    if (!userId) {
      throw new Error('User not found in database')
    }

    // ✅ Test the token before saving
    try {
      const testResponse = await fetch('https://api.upwork.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          query: '{ graphql { jobs { search(first: 1) { totalCount } } } }' 
        })
      })
      
      if (!testResponse.ok) {
        throw new Error('Token test failed')
      }
      
      console.log('✅ Token validated successfully')
    } catch (testError) {
      console.error('❌ Token validation failed:', testError)
      throw new Error('Access token is invalid')
    }

    // ✅ Save to database
    await pool.query(
      `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, upwork_user_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         access_token = $2, 
         refresh_token = $3,
         upwork_user_id = $4,
         updated_at = NOW()`,
      [userId, tokenData.access_token, tokenData.refresh_token || '', tokenData.upwork_user_id || '']
    )

    console.log('✅ Upwork connection saved for user:', userId)

    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected&message=Upwork+connected+successfully')

  } catch (error: any) {
    console.error('❌ Callback error:', error)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error.message || 'Unknown error'))
  }
}