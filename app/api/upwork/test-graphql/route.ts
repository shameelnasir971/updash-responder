// app/api/upwork/test-graphql/route.ts - NEW FILE
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Database se token lo
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts LIMIT 1'
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({ error: 'No token found' })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Simple GraphQL introspection query
    const testQuery = {
      query: `
        query {
          __schema {
            types {
              name
              description
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
    
    const data = await response.json()
    
    return NextResponse.json({
      status: response.status,
      queryWorks: response.ok,
      responseKeys: Object.keys(data),
      errors: data.errors,
      availableTypes: data.data?.__schema?.types?.filter((t: any) => 
        t.name.toLowerCase().includes('job') || 
        t.name.toLowerCase().includes('search')
      ).map((t: any) => t.name)
    })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message })
  }
}