// app/api/upwork/callback/route.ts - WORKING VERSION
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  let userId: string | null = null
  
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    const state = searchParams.get('state')

    console.log('🔄 Upwork callback received')
    console.log('Has code:', !!code)
    console.log('Error:', error)
    console.log('State from URL:', state)

    // Get stored state from cookie
    const cookieStore = cookies()
    const storedState = cookieStore.get('upwork_state')?.value
    userId = cookieStore.get('upwork_user_id')?.value || null

    console.log('Stored state from cookie:', storedState)
    console.log('User ID from cookie:', userId)

    // Validate state
    if (!storedState || !state || storedState !== state) {
      console.error('❌ State validation failed')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=state_mismatch')
    }

    if (error) {
      console.error('❌ Upwork returned error:', error)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error))
    }

    if (!code) {
      console.error('❌ No authorization code received')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_code')
    }

    if (!userId) {
      console.error('❌ No user ID found')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=no_user')
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = process.env.UPWORK_REDIRECT_URI

    if (!clientId || !clientSecret || !redirectUri) {
      console.error('❌ Missing environment variables')
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=config_error')
    }

    console.log('🔄 Exchanging code for token...')

    // IMPORTANT: Use Upwork's API v2 for token exchange (more stable)
    const tokenResponse = await fetch('https://www.upwork.com/api/v2/oauth2/token', {
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

    console.log('Token exchange status:', tokenResponse.status)

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=token_failed')
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token received successfully')
    console.log('Access token length:', tokenData.access_token?.length)

    // Clean up cookies
    cookieStore.delete('upwork_state')
    cookieStore.delete('upwork_user_id')

    // Save to database
    try {
      await pool.query(
        `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           access_token = EXCLUDED.access_token, 
           refresh_token = EXCLUDED.refresh_token,
           updated_at = NOW()`,
        [parseInt(userId), tokenData.access_token, tokenData.refresh_token || null]
      )
      console.log('✅ Tokens saved to database for user:', userId)
    } catch (dbError: any) {
      console.error('❌ Database error:', dbError.message)
      // Try creating table if doesn't exist
      try {
        await pool.query(`
          CREATE TABLE IF NOT EXISTS upwork_accounts (
            user_id INTEGER PRIMARY KEY,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
          )
        `)
        // Retry insertion
        await pool.query(
          `INSERT INTO upwork_accounts (user_id, access_token, refresh_token) 
           VALUES ($1, $2, $3)`,
          [parseInt(userId), tokenData.access_token, tokenData.refresh_token || null]
        )
      } catch (retryError) {
        console.error('Failed to create table or insert:', retryError)
      }
    }

    console.log('✅ Upwork connection successful! Redirecting...')

    // Redirect to dashboard with success
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?upwork_connected=true&success=1')

  } catch (error: any) {
    console.error('❌ Callback error:', error.message || error)
    
    // Clean up cookies on error
    try {
      const cookieStore = cookies()
      cookieStore.delete('upwork_state')
      cookieStore.delete('upwork_user_id')
    } catch {}
    
    return NextResponse.redirect(`https://updash.shameelnasir.com/dashboard?error=callback_error&message=${encodeURIComponent(error.message || 'Unknown error')}`)
  }
}