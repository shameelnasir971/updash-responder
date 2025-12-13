import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export async function GET() {
  try {
    const result = await pool.query('SELECT access_token FROM upwork_accounts LIMIT 1')
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No Upwork connection' })
    }
    
    const accessToken = result.rows[0].access_token
    
    // Schema introspection query
    const schemaQuery = {
      query: `
        query IntrospectionQuery {
          __type(name: "MarketplaceJobPostingSearchResult") {
            name
            fields {
              name
              type {
                name
                kind
                ofType {
                  name
                  kind
                }
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
      },
      body: JSON.stringify(schemaQuery)
    })
    
    const data = await response.json()
    
    return NextResponse.json({
      success: true,
      availableFields: data.data?.__type?.fields?.map((f: any) => f.name) || []
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      success: false
    })
  }
}