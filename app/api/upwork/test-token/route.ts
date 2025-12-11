import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export async function GET() {
  try {
    // Get token
    const result = await pool.query('SELECT access_token FROM upwork_accounts LIMIT 1')
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No token found' })
    }
    
    const accessToken = result.rows[0].access_token
    
    // Test token with a simple query
    const testQuery = {
      query: `{
        __schema {
          queryType {
            name
            fields {
              name
              description
            }
          }
        }
      }`
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
        error: 'Token invalid',
        status: response.status,
        statusText: response.statusText
      })
    }
    
    const data = await response.json()
    
    // Check available queries
    const queries = data.data?.__schema?.queryType?.fields || []
    const jobQueries = queries.filter((q: any) => 
      q.name.toLowerCase().includes('job')
    )
    
    return NextResponse.json({
      success: true,
      tokenValid: true,
      tokenLength: accessToken.length,
      availableJobQueries: jobQueries.map((q: any) => q.name),
      allQueries: queries.map((q: any) => q.name)
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      success: false
    })
  }
}