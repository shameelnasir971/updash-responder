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
    const errorDesc = searchParams.get('error_description')
    const state = searchParams.get('state')

    console.log('🔄 Upwork Callback:', { 
      hasCode: !!code,
      error,
      state: state ? Buffer.from(state, 'base64').toString() : 'No state'
    })

    if (error) {
      console.error('❌ Upwork authorization error:', errorDesc || error)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(errorDesc || error))
    }

    if (!code) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=No authorization code received')
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
        scope: 'r_jobs'
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', tokenResponse.status, errorText)
      throw new Error(`Token exchange failed: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful')
    console.log('🔐 Access token received:', tokenData.access_token ? 'Yes' : 'No')

    // ✅ TEST: Fetch user info to verify connection works
    try {
      console.log('🧪 Testing connection by fetching user info...')
      const testResponse = await fetch('https://www.upwork.com/api/auth/v1/info.json', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json'
        }
      })
      
      if (testResponse.ok) {
        const userInfo = await testResponse.json()
        console.log('✅ Connection test successful:', userInfo)
      } else {
        console.warn('⚠️ User info fetch failed but continuing')
      }
    } catch (testError) {
      console.warn('⚠️ Connection test skipped:', testError)
    }

    // ✅ Get user ID from state or database
    let userId: number
    if (state) {
      try {
        userId = parseInt(Buffer.from(state, 'base64').toString())
      } catch {
        // Fallback to first user
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

    // ✅ Save to database
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

    console.log('✅ Upwork connection saved for user:', userId)

    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=true&message=Upwork+connected+successfully')

  } catch (error: any) {
    console.error('❌ Callback error:', error)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error.message || 'Unknown error'))
  }
}