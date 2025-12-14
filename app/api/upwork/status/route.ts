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
      }, { status: 200 })
    }

    const result = await pool.query(
      `SELECT id, connection_status, created_at 
       FROM upwork_accounts 
       WHERE user_id = $1 AND connection_status = 'connected'`,
      [user.id]
    )
    
    return NextResponse.json({
      connected: result.rows.length > 0,
      connectionStatus: result.rows[0]?.connection_status || 'disconnected',
      message: result.rows.length > 0 ? 'Upwork connected' : 'Not connected'
    })
    
  } catch (error) {
    return NextResponse.json({
      connected: false,
      message: 'Status check failed'
    }, { status: 200 })
  }
}