// Add this temporary debug endpoint
// Create file: /app/api/upwork/debug/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({ error: 'No Upwork token' })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // VERY SIMPLE GraphQL query to test
    const testQuery = {
      query: `query { __schema { types { name } } }`
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testQuery)
    })
    
    const data = await response.json()
    
    return NextResponse.json({
      status: response.status,
      data: data,
      tokenPreview: accessToken.substring(0, 30) + '...'
    })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}