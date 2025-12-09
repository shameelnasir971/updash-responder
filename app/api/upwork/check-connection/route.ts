//  app/api/upwork/check-connection/route.ts

import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Check if any Upwork account exists
    const result = await pool.query('SELECT COUNT(*) as count FROM upwork_accounts')
    const hasConnection = parseInt(result.rows[0].count) > 0
    
    return NextResponse.json({ 
      success: true,
      connected: hasConnection,
      message: hasConnection ? 'Upwork connected' : 'Not connected'
    })
  } catch (error) {
    return NextResponse.json({ 
      success: false,
      connected: false,
      error: 'Database error'
    }, { status: 500 })
  }
}