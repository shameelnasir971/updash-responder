// app/api/upwork/status/route.ts
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import jwt from 'jsonwebtoken'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const JWT_SECRET = process.env.JWT_SECRET!

export async function GET() {
  try {
    // 1️⃣ Cookie se token lo
    const token = cookies().get('session-token')?.value

    if (!token) {
      return NextResponse.json({
        success: true,
        connected: false,
        reason: 'No session token'
      })
    }

    // 2️⃣ Token verify
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch {
      return NextResponse.json({
        success: true,
        connected: false,
        reason: 'Invalid token'
      })
    }

    // 3️⃣ DB check
    const result = await pool.query(
      'SELECT id FROM upwork_accounts WHERE user_id = $1',
      [decoded.userId]
    )

    return NextResponse.json({
      success: true,
      connected: result.rows.length > 0
    })

  } catch (error) {
    console.error('❌ Upwork status error:', error)
    return NextResponse.json({
      success: true,
      connected: false
    })
  }
}
