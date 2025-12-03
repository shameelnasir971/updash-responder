// app/api/upwork/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')

    if (error) {
      console.error('❌ OAuth error:', error)
      return NextResponse.redirect(new URL('/dashboard?error=oauth_failed', request.url))
    }

    if (!code) {
      return NextResponse.redirect(new URL('/dashboard?error=no_code', request.url))
    }

    console.log('✅ Received authorization code:', code)
    
    // Get user from session or query params
    const userResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/auth`, {
      headers: {
        'Cookie': request.headers.get('cookie') || ''
      }
    })
    
    if (userResponse.ok) {
      const user = await userResponse.json()
      
      // Exchange code for token
      const clientId = process.env.UPWORK_CLIENT_ID
      const clientSecret = process.env.UPWORK_CLIENT_SECRET
      const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'

      if (!clientId || !clientSecret) {
        throw new Error('Upwork credentials missing')
      }

      console.log('🔄 Exchanging code for token...')
      
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

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('❌ Token exchange failed:', errorText)
        return NextResponse.redirect(new URL('/dashboard?error=token_failed', request.url))
      }

      const tokenData = await tokenResponse.json()
      console.log('✅ Token received successfully')
      
      // Save to database
      await pool.query(
        `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           access_token = $2, 
           refresh_token = $3, 
           updated_at = NOW()`,
        [user.id, tokenData.access_token, tokenData.refresh_token]
      )

      console.log('✅ Upwork account saved to database')
      
      // Redirect to dashboard with success
      return NextResponse.redirect(new URL('/dashboard?success=upwork_connected', request.url))
      
    } else {
      return NextResponse.redirect(new URL('/auth/login?redirect=upwork', request.url))
    }
    
  } catch (error: any) {
    console.error('❌ Callback error:', error)
    return NextResponse.redirect(new URL('/dashboard?error=callback_error', request.url))
  }
}