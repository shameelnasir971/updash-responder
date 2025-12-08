// app/api/upwork/test-token/route.ts - NEW FILE
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Get latest token from database
    const result = await pool.query(
      'SELECT access_token, created_at FROM upwork_accounts LIMIT 1'
    )
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        connected: false,
        message: 'No Upwork token in database'
      })
    }
    
    const accessToken = result.rows[0].access_token
    
    // ✅ CORRECT UPWORK GRAPHQL QUERY (FROM OFFICIAL DOCS)
    const testQuery = {
      query: `
        query TestQuery {
          graphql {
            jobs {
              search(first: 5) {
                totalCount
              }
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
        'Accept': 'application/json'
      },
      body: JSON.stringify(testQuery)
    })
    
    if (!response.ok) {
      return NextResponse.json({
        tokenValid: false,
        status: response.status,
        error: `HTTP Error: ${response.status}`
      })
    }
    
    const data = await response.json()
    
    return NextResponse.json({
      tokenValid: true,
      status: response.status,
      response: data,
      tokenPreview: accessToken.substring(0, 30) + '...'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      tokenValid: false
    })
  }
}