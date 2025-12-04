// app/api/upwork/status/route.ts - UPDATED
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
        error: 'Not authenticated' 
      })
    }

    const result = await pool.query(
      'SELECT access_token, created_at FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    const connected = result.rows.length > 0 && result.rows[0].access_token
    const connectionDate = connected ? result.rows[0].created_at : null

    return NextResponse.json({ 
      connected,
      connectionDate,
      message: connected ? '✅ Upwork account connected' : '🔗 Connect your Upwork account',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    })
  } catch (error: any) {
    console.error('Status check error:', error)
    return NextResponse.json({ 
      connected: false,
      error: error.message 
    })
  }
}