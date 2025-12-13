//app/api/upwork/callback/route.ts
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Get Tenant ID from alternative source
async function getTenantId(accessToken: string) {
  try {
    console.log('🔍 Getting user info for tenant ID...')
    
    // Simple query to get current user
    const userQuery = {
      query: `{ user { id nid } }`
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userQuery)
    })
    
    if (response.ok) {
      const data = await response.json()
      console.log('User query response:', JSON.stringify(data).substring(0, 200))
      
      if (data.data?.user?.id) {
        console.log('✅ Tenant ID found:', data.data.user.id)
        return data.data.user.id
      }
    }
    
    // Fallback: Extract from JWT
    try {
      const tokenParts = accessToken.split('.')
      if (tokenParts.length === 3) {
        const payload = JSON.parse(Buffer.from(tokenParts[1], 'base64').toString())
        console.log('JWT payload:', JSON.stringify(payload).substring(0, 200))
        return payload.sub || payload.user_id || payload.client_id || null
      }
    } catch (e) {
      console.log('JWT decode failed')
    }
    
    return null
  } catch (error) {
    console.error('Tenant ID error:', error)
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    
    if (!code) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=No+code')
    }
    
    console.log('=== UPWORK CALLBACK START ===')
    
    // Environment check
    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = 'https://updash.shameelnasir.com/api/upwork/callback'
    
    if (!clientId || !clientSecret) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=Config+missing')
    }
    
    // 1. Exchange code for token
    console.log('🔄 Exchanging code for token...')
    const tokenUrl = 'https://www.upwork.com/api/v3/oauth2/token'
    
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    })
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })
    
    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Token exchange failed:', errorText)
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=Token+failed')
    }
    
    const tokenData = await tokenResponse.json()
    console.log('✅ Token received')
    
    // 2. Get Tenant ID (try but don't fail if we can't)
    const tenantId = await getTenantId(tokenData.access_token)
    
    // 3. Save to database
    console.log('💾 Saving to database...')
    const users = await pool.query('SELECT id FROM users LIMIT 1')
    
    if (users.rows.length === 0) {
      return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=No+user')
    }
    
    const userId = users.rows[0].id
    
    const insertQuery = `
      INSERT INTO upwork_accounts (user_id, access_token, refresh_token, upwork_user_id, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (user_id) 
      DO UPDATE SET 
        access_token = $2, 
        refresh_token = $3,
        upwork_user_id = $4,
        updated_at = NOW()
      RETURNING id
    `
    
    await pool.query(insertQuery, [
      userId,
      tokenData.access_token,
      tokenData.refresh_token || '',
      tenantId || ''
    ])
    
    console.log('✅ Database updated')
    console.log('=== UPWORK CALLBACK COMPLETE ===')
    
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?success=true&message=Upwork+connected!')
    
  } catch (error: any) {
    console.error('❌ Callback error:', error.message)
    return NextResponse.redirect('https://updash.shameelnasir.com/dashboard?error=' + encodeURIComponent(error.message))
  }
}
