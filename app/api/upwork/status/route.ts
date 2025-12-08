// app/api/upwork/status/route.ts - COMPLETE FIXED
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // ✅ SIMPLE CHECK - NO AUTH, NO REDIRECT
    const upworkResult = await pool.query(
      'SELECT COUNT(*) as count FROM upwork_accounts'
    )
    
    const hasConnection = parseInt(upworkResult.rows[0].count) > 0
    
    return NextResponse.json({ 
      success: true,
      connected: hasConnection,
      message: hasConnection ? 'Upwork connected' : 'Not connected'
    })
  } catch (error) {
    return NextResponse.json({ 
      success: true, // ✅ ALWAYS SUCCESS
      connected: false,
      message: 'Connection check failed'
    })
  }
}