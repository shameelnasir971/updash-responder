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

    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    if (upworkResult.rows.length === 0) {
      return NextResponse.json({ success: false, error: 'No Upwork account connected' })
    }

    const accessToken = upworkResult.rows[0].access_token
    const tokenPreview = accessToken ? `${accessToken.substring(0, 20)}...` : 'EMPTY'

    // Try a SIMPLE Upwork API call - get user profile (usually works with valid token)
    const testResponse = await fetch('https://www.upwork.com/api/auth/v1/info.json', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      }
    })

    const testResult = {
      tokenPreview: tokenPreview,
      tokenLength: accessToken?.length || 0,
      testApiStatus: testResponse.status,
      testApiStatusText: testResponse.statusText,
      testApiOk: testResponse.ok
    }

    console.log('🔐 Token Test Result:', testResult)

    if (!testResponse.ok) {
      return NextResponse.json({ 
        success: false, 
        message: 'Token is INVALID or EXPIRED',
        details: testResult
      })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Token appears VALID for basic API call',
      details: testResult
    })

  } catch (error: any) {
    console.error('Token test error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Test failed: ' + error.message 
    }, { status: 500 })
  }
}