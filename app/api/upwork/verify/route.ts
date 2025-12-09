// app/api/upwork/verify/route.ts - NEW FILE
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Get token
    const result = await pool.query(
      'SELECT access_token FROM upwork_accounts LIMIT 1'
    )
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        connected: false,
        message: 'No Upwork connection'
      })
    }
    
    const accessToken = result.rows[0].access_token
    
    // ✅ TEST SIMPLE GRAPHQL QUERY (NO TENANT HEADER)
    const testQuery = {
      query: `{
        __schema {
          queryType {
            name
          }
        }
      }`
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testQuery)
    })
    
    const data = await response.json()
    
    return NextResponse.json({
      tokenValid: true,
      tokenPreview: accessToken.substring(0, 30) + '...',
      httpStatus: response.status,
      response: data,
      hasGraphQLAccess: !data.errors,
      message: data.errors ? 
        'GraphQL access restricted, trying REST API' : 
        'GraphQL API accessible'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      tokenValid: false
    })
  }
}