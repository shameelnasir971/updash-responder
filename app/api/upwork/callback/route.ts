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
    const errorDesc = searchParams.get('error_description')

    console.log('🔄 Callback received:', { 
      hasCode: !!code, 
      error: error,
      errorDesc: errorDesc 
    })

    if (error) {
      console.error('❌ Upwork error:', errorDesc || error)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(errorDesc || error))
    }

    if (!code) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_code_received')
    }

    console.log('✅ Got authorization code')

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'

    // ✅ TOKEN EXCHANGE
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    
    const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri
      })
    })

    const tokenText = await tokenResponse.text()
    console.log('📄 Token response:', tokenText.substring(0, 200))

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status} - ${tokenText}`)
    }

    const tokenData = JSON.parse(tokenText)
    console.log('✅ Token exchange successful')

    // ✅ FIND USER ID (single user system)
    const users = await pool.query('SELECT id FROM users LIMIT 1')
    const userId = users.rows[0]?.id

    if (!userId) {
      throw new Error('No user found in database')
    }

    // ✅ SAVE TO DATABASE
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

    console.log('✅ Upwork account saved for user:', userId)

    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=upwork_connected')

  } catch (error: any) {
    console.error('❌ Callback error:', error)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error.message))
  }
}