// app/api/upwork/status/route.ts


import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI
    
    // Check if Upwork API is configured
    const isConfigured = !!(clientId && redirectUri)

    // Check if user has connected Upwork account
    const upworkResult = await pool.query(
      'SELECT * FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    const hasConnectedAccount = upworkResult.rows.length > 0

    return NextResponse.json({ 
      success: true,
      configured: isConfigured,
      connected: hasConnectedAccount,
      message: hasConnectedAccount ? 'Upwork account connected' : 'Upwork account not connected'
    })
  } catch (error) {
    console.error('Upwork status error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 })
  }
}