//app/api/upwork/live-auth/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // ❌ DISABLE THIS ENDPOINT - USE /auth INSTEAD
    return NextResponse.json({ 
      success: false,
      error: 'Please use /api/upwork/auth endpoint instead',
      url: null
    }, { status: 400 })
  } catch (error) {
    console.error('OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { authorizationCode } = await request.json()

    if (!authorizationCode) {
      return NextResponse.json({ error: 'Authorization code required' }, { status: 400 })
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'

    if (!clientId || !clientSecret) {
      return NextResponse.json({ 
        error: 'Upwork API credentials missing in Railway' 
      }, { status: 500 })
    }

    console.log('🔄 Exchanging authorization code for access token...')

    // Exchange authorization code for access token
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
    const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: authorizationCode,
        redirect_uri: redirectUri
      })
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText)
      return NextResponse.json({ 
        error: 'Failed to exchange authorization code for token' 
      }, { status: 400 })
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token exchange successful')
    
    // Save tokens to database
    await pool.query(
      `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         access_token = $2, 
         refresh_token = $3, 
         created_at = NOW()`,
      [user.id, tokenData.access_token, tokenData.refresh_token]
    )

    console.log('✅ Upwork account connected successfully for user:', user.id)
    
    return NextResponse.json({ 
      success: true,
      message: 'Upwork account connected successfully! You can now load real jobs and send proposals.'
    })
    
  } catch (error: any) {
    console.error('❌ OAuth token exchange error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to connect Upwork account: ' + error.message 
    }, { status: 500 })
  }
}