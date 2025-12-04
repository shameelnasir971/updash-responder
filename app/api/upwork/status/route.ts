// app/api/upwork/status/route.ts


import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        connected: false, 
        error: 'Not authenticated' 
      }, { status: 401 })
    }

    console.log('🔍 Checking Upwork status for user:', user.id)

    const result = await pool.query(
      `SELECT access_token, refresh_token, connected_at, 
              expires_at > NOW() as token_valid
       FROM upwork_accounts 
       WHERE user_id = $1`,
      [user.id]
    )

    const connected = result.rows.length > 0 && 
                     result.rows[0].access_token && 
                     result.rows[0].token_valid

    console.log('📊 Upwork status:', {
      connected,
      hasToken: result.rows.length > 0,
      tokenValid: result.rows[0]?.token_valid,
      connectedAt: result.rows[0]?.connected_at
    })

    return NextResponse.json({ 
      success: true,
      connected: connected,
      connectedAt: result.rows[0]?.connected_at,
      hasValidToken: result.rows[0]?.token_valid,
      details: connected ? 'Upwork account is connected' : 'Upwork account is not connected'
    })

  } catch (error: any) {
    console.error('❌ Status check error:', error)
    return NextResponse.json({ 
      success: false,
      connected: false,
      error: error.message 
    }, { status: 500 })
  }
}