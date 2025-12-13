import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Get token
    const result = await pool.query('SELECT access_token FROM upwork_accounts LIMIT 1')
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No Upwork connection' })
    }
    
    const accessToken = result.rows[0].access_token
    
    // Simple schema introspection
    const introspectionQuery = {
      query: `
        query IntrospectionQuery {
          __schema {
            queryType {
              name
              fields {
                name
                description
                args {
                  name
                  type {
                    name
                  }
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
      body: JSON.stringify(introspectionQuery)
    })
    
    if (!response.ok) {
      return NextResponse.json({
        error: 'API call failed',
        status: response.status,
        tokenLength: accessToken.length
      })
    }
    
    const data = await response.json()
    
    // Find available job queries
    const queryFields = data.data?.__schema?.queryType?.fields || []
    const jobQueries = queryFields.filter((field: any) => 
      field.name.toLowerCase().includes('job') || 
      field.name.toLowerCase().includes('search')
    )
    
    // Try to get jobs with available query
    let jobData = null
    if (jobQueries.length > 0) {
      const jobQueryName = jobQueries[0].name
      console.log('🔍 Trying query:', jobQueryName)
      
      const jobQuery = {
        query: `query { ${jobQueryName} { totalCount edges { node { id title } } } }`
      }
      
      const jobResponse = await fetch('https://api.upwork.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(jobQuery)
      })
      
      if (jobResponse.ok) {
        jobData = await jobResponse.json()
      }
    }
    
    return NextResponse.json({
      success: true,
      tokenValid: true,
      tokenLength: accessToken.length,
      availableJobQueries: jobQueries.map((q: any) => ({
        name: q.name,
        args: q.args.map((a: any) => a.name)
      })),
      jobSample: jobData,
      rawSchema: queryFields.map((f: any) => f.name)
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      success: false
    })
  }
}