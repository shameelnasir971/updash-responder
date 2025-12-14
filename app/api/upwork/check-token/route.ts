import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        success: false,
        authenticated: false,
        error: 'Not authenticated' 
      })
    }
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token, upwork_user_id, created_at FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        authenticated: true,
        upworkConnected: false,
        message: 'Upwork not connected'
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    const upworkUserId = upworkResult.rows[0].upwork_user_id
    const createdAt = upworkResult.rows[0].created_at
    
    // Test the token with a simple API call
    let tokenValid = false
    let testResponse = null
    
    try {
      // Simple test query
      const testQuery = {
        query: `{ user { id } }`
      }
      
      const response = await fetch('https://api.upwork.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(testQuery)
      })
      
      if (response.ok) {
        const data = await response.json()
        tokenValid = !data.errors
        testResponse = data.errors ? data.errors[0]?.message : 'Token valid'
      } else {
        testResponse = `HTTP ${response.status}: ${response.statusText}`
      }
    } catch (error: any) {
      testResponse = `Test error: ${error.message}`
    }
    
    return NextResponse.json({
      success: true,
      authenticated: true,
      upworkConnected: true,
      tokenValid: tokenValid,
      upworkUserId: upworkUserId,
      connectedSince: createdAt,
      testResult: testResponse,
      message: tokenValid ? 'Upwork token is valid' : 'Upwork token may be expired'
    })
    
  } catch (error: any) {
    console.error('Token check error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      authenticated: false,
      upworkConnected: false
    }, { status: 500 })
  }
}