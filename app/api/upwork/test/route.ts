import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const upworkResult = await pool.query(
      'SELECT access_token, upwork_user_id FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        connected: false,
        message: 'No Upwork account connected'
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Test API call
    const testResponse = await fetch('https://www.upwork.com/api/auth/v1/info.json', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    })
    
    const testData = await testResponse.json()
    
    return NextResponse.json({
      success: true,
      connected: true,
      tokenValid: testResponse.ok,
      status: testResponse.status,
      data: testData,
      message: testResponse.ok ? '✅ Token is valid' : '❌ Token invalid'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      connected: false,
      error: error.message
    }, { status: 500 })
  }
}