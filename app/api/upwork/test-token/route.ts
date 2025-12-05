// app/api/upwork/test-token/route.ts - TEST ONLY

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
    
    if (!upworkResult.rows[0]?.access_token) {
      return NextResponse.json({ 
        success: false,
        message: 'No Upwork token found'
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Test with simple endpoint
    const testUrl = 'https://www.upwork.com/api/auth/v1/info.json'
    const response = await fetch(testUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    const result = {
      status: response.status,
      ok: response.ok,
      hasToken: !!accessToken
    }
    
    if (response.ok) {
      const data = await response.json()
      return NextResponse.json({ 
        success: true,
        message: 'Token is valid',
        data: data,
        testResult: result
      })
    } else {
      const errorText = await response.text()
      return NextResponse.json({ 
        success: false,
        message: 'Token test failed',
        error: errorText,
        testResult: result
      })
    }
    
  } catch (error: any) {
    console.error('Token test error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}