import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    await pool.query(
      'DELETE FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    return NextResponse.json({ 
      success: true,
      message: 'Upwork disconnected successfully'
    })
  } catch (error: any) {
    console.error('Disconnect error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}