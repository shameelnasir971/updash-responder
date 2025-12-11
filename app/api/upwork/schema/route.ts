//app/api/upwork/schema/route.ts

import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    console.log('=== GRAPHQL SCHEMA DISCOVERY ===')
    
    // Get access token
    const result = await pool.query(
      'SELECT access_token FROM upwork_accounts LIMIT 1'
    )
    
    if (result.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No Upwork token. Connect account first.'
      })
    }
    
    const accessToken = result.rows[0].access_token
    
    // GraphQL Introspection Query (sabse important part)
    const introspectionQuery = {
      query: `
        query IntrospectionQuery {
          __schema {
            queryType { name }
            mutationType { name }
            subscriptionType { name }
            types {
              name
              kind
              description
              fields {
                name
                description
                type {
                  name
                  kind
                  ofType { name kind }
                }
                args {
                  name
                  description
                  type { name kind }
                }
              }
            }
          }
        }
      `
    }
    
    console.log('🔍 Discovering GraphQL schema...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(introspectionQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Schema discovery failed:', errorText)
      return NextResponse.json({
        success: false,
        error: 'Discovery failed'
      })
    }
    
    const data = await response.json()
    
    if (data.errors) {
      console.error('❌ Introspection errors:', data.errors)
      return NextResponse.json({
        success: false,
        error: data.errors[0]?.message
      })
    }
    
    console.log('✅ Schema discovery successful!')
    
    // Find job-related types and queries
    const schema = data.data.__schema
    const allTypes = schema.types || []
    
    // Find Query type
    const queryType = allTypes.find((t: any) => t.name === 'Query')
    const availableQueries = queryType?.fields?.map((f: any) => f.name) || []
    
    // Find types with 'job' in name
    const jobTypes = allTypes.filter((t: any) => 
      t.name.toLowerCase().includes('job') || 
      t.name.toLowerCase().includes('search')
    ).map((t: any) => ({
      name: t.name,
      description: t.description,
      fields: t.fields?.map((f: any) => f.name) || []
    }))
    
    return NextResponse.json({
      success: true,
      message: 'Schema discovered',
      data: {
        availableQueries: availableQueries,
        jobRelatedTypes: jobTypes,
        totalTypes: allTypes.length
      }
    })
    
  } catch (error: any) {
    console.error('❌ Schema discovery error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}