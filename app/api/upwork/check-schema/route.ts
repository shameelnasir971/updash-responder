//  app/api/upwork/check-schema/route.ts


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
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'Upwork not connected'
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Try a simple introspection query
    const testQuery = {
      query: `
        query TestQuery {
          __schema {
            types {
              name
              kind
            }
          }
        }
      `
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testQuery)
    })
    
    if (!response.ok) {
      return NextResponse.json({
        success: false,
        error: `API error: ${response.status}`
      })
    }
    
    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      data: data,
      message: 'Schema test successful'
    })
    
  } catch (error: any) {
    console.error('Schema test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}