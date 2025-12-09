// app/api/upwork/debug/route.ts - NEW FILE
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
        success: false,
        message: 'No Upwork connection'
      })
    }
    
    const accessToken = result.rows[0].access_token
    
    // Test query
    const testQuery = {
      query: `
        query DebugQuery {
          graphql {
            __schema {
              queryType {
                name
              }
              types {
                name
                kind
                description
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testQuery)
    })
    
    const data = await response.json()
    
    // Find job-related types
    const jobTypes = data.data?.graphql?.__schema?.types?.filter((t: any) => 
      t.name.toLowerCase().includes('job') || 
      t.name.toLowerCase().includes('search')
    ) || []
    
    return NextResponse.json({
      success: true,
      tokenPresent: true,
      tokenPreview: accessToken.substring(0, 30) + '...',
      httpStatus: response.status,
      graphqlErrors: data.errors || [],
      jobTypesFound: jobTypes.map((t: any) => t.name),
      availableQueries: jobTypes.filter((t: any) => 
        t.kind === 'OBJECT' && t.name === 'Query'
      ).map((t: any) => t.fields || [])[0] || [],
      rawResponse: data
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    })
  }
}

