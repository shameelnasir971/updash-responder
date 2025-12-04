// app/api/upwork/debug/route.ts
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

    // Check database connection
    const dbResult = await pool.query(
      'SELECT COUNT(*) as count FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    // Check environment variables
    const envVars = {
      UPWORK_CLIENT_ID: process.env.UPWORK_CLIENT_ID ? 'Set' : 'Missing',
      UPWORK_CLIENT_SECRET: process.env.UPWORK_CLIENT_SECRET ? 'Set' : 'Missing',
      UPWORK_REDIRECT_URI: process.env.UPWORK_REDIRECT_URI || 'Missing'
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email
      },
      database: {
        connected: true,
        upworkAccounts: dbResult.rows[0].count
      },
      environment: envVars,
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}