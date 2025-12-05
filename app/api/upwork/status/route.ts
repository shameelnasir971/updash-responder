
// app/api/upwork/status/route.ts

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

    // Check if user has connected Upwork account
    const upworkResult = await pool.query(
      'SELECT access_token, created_at FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    const hasConnectedAccount = upworkResult.rows.length > 0
    let tokenValid = false
    
    // Test the token if exists
    if (hasConnectedAccount) {
      const accessToken = upworkResult.rows[0].access_token
      try {
        const testResponse = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            query: '{ graphql { jobs { search(first: 1) { totalCount } } } }' 
          })
        })
        
        tokenValid = testResponse.ok
      } catch (error) {
        tokenValid = false
      }
    }

    return NextResponse.json({ 
      success: true,
      configured: true,
      connected: hasConnectedAccount,
      tokenValid: tokenValid,
      message: hasConnectedAccount ? 
        (tokenValid ? 'Upwork account connected & token valid' : 'Upwork connected but token expired') : 
        'Upwork account not connected'
    })
  } catch (error) {
    console.error('Upwork status error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 })
  }
}