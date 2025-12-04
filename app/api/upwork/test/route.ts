import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT * FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    const connectionStatus = {
      hasRecord: upworkResult.rows.length > 0,
      hasAccessToken: upworkResult.rows.length > 0 && upworkResult.rows[0].access_token,
      hasRefreshToken: upworkResult.rows.length > 0 && upworkResult.rows[0].refresh_token,
      expiresAt: upworkResult.rows.length > 0 ? upworkResult.rows[0].expires_at : null,
      user_id: upworkResult.rows.length > 0 ? upworkResult.rows[0].user_id : null
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email
      },
      upworkConnection: connectionStatus,
      environment: {
        clientId: process.env.UPWORK_CLIENT_ID ? 'Present' : 'Missing',
        clientSecret: process.env.UPWORK_CLIENT_SECRET ? 'Present' : 'Missing',
        redirectUri: process.env.UPWORK_REDIRECT_URI || 'Missing'
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}