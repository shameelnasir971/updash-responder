//app/api/upwork/refresh-token/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('🔄 Attempting token refresh for user:', user.id)

    // Get current tokens
    const upworkResult = await pool.query(
      `SELECT access_token, refresh_token 
       FROM upwork_accounts WHERE user_id = $1`,
      [user.id]
    )

    if (upworkResult.rows.length === 0) {
      return NextResponse.json({ 
        success: false,
        message: 'No Upwork account found. Please connect first.',
        requiresReconnect: true
      })
    }

    const accessToken = upworkResult.rows[0].access_token
    const refreshToken = upworkResult.rows[0].refresh_token

    if (!refreshToken) {
      return NextResponse.json({
        success: false,
        message: 'No refresh token available. Please reconnect Upwork.',
        requiresReconnect: true
      })
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return NextResponse.json({ 
        success: false,
        message: 'Upwork configuration missing',
        requiresReconnect: true
      })
    }

    console.log('🔄 Refreshing token using refresh token...')

    // Try to refresh
    const tokenUrl = 'https://www.upwork.com/api/v3/oauth2/token'
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Token refresh failed:', errorText)
      
      return NextResponse.json({
        success: false,
        message: 'Token refresh failed. Please reconnect Upwork.',
        requiresReconnect: true,
        status: response.status
      })
    }

    const tokenData = await response.json()
    console.log('✅ Token refresh successful')

    // Update database
    await pool.query(
      `UPDATE upwork_accounts SET 
         access_token = $1,
         refresh_token = $2,
         updated_at = NOW()
       WHERE user_id = $3`,
      [tokenData.access_token, tokenData.refresh_token || refreshToken, user.id]
    )

    return NextResponse.json({
      success: true,
      message: 'Token refreshed successfully!',
      requiresReconnect: false
    })

  } catch (error: any) {
    console.error('❌ Token refresh error:', error)
    return NextResponse.json({
      success: false,
      message: 'Token refresh error: ' + error.message,
      requiresReconnect: true
    })
  }
}