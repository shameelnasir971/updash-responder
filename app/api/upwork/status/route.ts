// app/api/upwork/status/route.ts - FINAL & CORRECT VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    
    // Agar user logged in nahi hai
    if (!user) {
      return NextResponse.json({
        success: true,
        connected: false,
        message: 'User not authenticated'
      })
    }

    // Current user ke liye check karo
    const result = await pool.query(
      'SELECT id FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    const connected = result.rows.length > 0

    return NextResponse.json({
      success: true,
      connected,
      message: connected ? 'Upwork connected' : 'Upwork not connected'
    })

  } catch (error) {
    console.error('Upwork status check error:', error)
    // Error mein bhi safe response
    return NextResponse.json({
      success: true,
      connected: false,
      message: 'Status check failed, assuming not connected'
    })
  }
}