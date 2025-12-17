import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    
    if (!code) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=No+authorization+code`)
    }
    
    console.log('=== UPWORK CALLBACK START ===')
    
    // Environment check
    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = process.env.UPWORK_REDIRECT_URI
    
    if (!clientId || !clientSecret || !redirectUri) {
      console.error('❌ Missing environment variables')
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=Configuration+missing`)
    }
    
    // 1. Exchange code for token
    console.log('🔄 Exchanging code for token...')
    
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
      console.error('❌ Token exchange failed:', errorText)
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=Token+exchange+failed`)
    }
    
    const tokenData = await tokenResponse.json()
    console.log('✅ Token received successfully')
    
    // 2. Get user info to verify
    console.log('🔍 Getting user info...')
    let upworkUserId = 'unknown'
    
    try {
      const userQuery = {
        query: `{ user { id uid } }`
      }
      
      const userResponse = await fetch('https://api.upwork.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userQuery)
      })
      
      if (userResponse.ok) {
        const userData = await userResponse.json()
        upworkUserId = userData.data?.user?.id || 'unknown'
        console.log('✅ User ID found:', upworkUserId)
      }
    } catch (userError) {
      console.log('⚠️ Could not fetch user info, using default')
    }
    
    // 3. Save to database
    console.log('💾 Saving to database...')
    
    // Get current user
    const users = await pool.query('SELECT id FROM users LIMIT 1')
    
    if (users.rows.length === 0) {
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=No+user+found`)
    }
    
    const userId = users.rows[0].id
    
    await pool.query(
      `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, upwork_user_id, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         access_token = $2,
         refresh_token = $3,
         upwork_user_id = $4,
         updated_at = NOW()`,
      [userId, tokenData.access_token, tokenData.refresh_token || '', upworkUserId]
    )
    
    console.log('✅ Database updated successfully')
    console.log('=== UPWORK CALLBACK COMPLETE ===')
    
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?success=true&message=Upwork+connected+successfully!`)
    
  } catch (error: any) {
    console.error('❌ Callback error:', error.message)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=${encodeURIComponent(error.message)}`)
  }
}