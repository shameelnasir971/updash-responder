// app/api/upwork/status/route.ts - SUPER SIMPLE VERSION
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const result = await pool.query(
      'SELECT id, upwork_user_id FROM upwork_accounts LIMIT 1'
    )
    
    return NextResponse.json({
      success: true,
      connected: result.rows.length > 0,
      hasUserId: result.rows.length > 0 && result.rows[0].upwork_user_id ? true : false
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      connected: false
    })
  }
}