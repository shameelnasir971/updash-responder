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
        connected: false,
        message: 'Not authenticated' 
      }, { status: 401 })
    }

    const result = await pool.query(
      `SELECT access_token, created_at, updated_at 
       FROM upwork_accounts 
       WHERE user_id = $1`,
      [user.id]
    )

    const connected = result.rows.length > 0 && 
                     result.rows[0].access_token && 
                     result.rows[0].access_token.length > 10

    return NextResponse.json({ 
      connected,
      hasToken: result.rows.length > 0,
      tokenLength: result.rows[0]?.access_token?.length || 0,
      lastUpdated: result.rows[0]?.updated_at,
      message: connected ? 'Upwork connected' : 'Upwork not connected'
    })
  } catch (error: any) {
    console.error('Status check error:', error)
    return NextResponse.json({ 
      connected: false,
      error: error.message,
      message: 'Error checking connection status'
    })
  }
}