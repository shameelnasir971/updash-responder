// app/api/upwork/discover/route.ts - NEW FILE
import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    // Get token
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts LIMIT 1'
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No Upwork account connected'
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // 1. Try GraphQL introspection
    const introspectionQuery = {
      query: `
        query IntrospectionQuery {
          __schema {
            queryType { name }
            mutationType { name }
            subscriptionType { name }
            types {
              ...FullType
            }
          }
        }
        
        fragment FullType on __Type {
          kind
          name
          description
          fields(includeDeprecated: true) {
            name
            description
            args {
              ...InputValue
            }
            type {
              ...TypeRef
            }
            isDeprecated
            deprecationReason
          }
          inputFields {
            ...InputValue
          }
          interfaces {
            ...TypeRef
          }
          enumValues(includeDeprecated: true) {
            name
            description
            isDeprecated
            deprecationReason
          }
          possibleTypes {
            ...TypeRef
          }
        }
        
        fragment InputValue on __InputValue {
          name
          description
          type { ...TypeRef }
          defaultValue
        }
        
        fragment TypeRef on __Type {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                      }
                    }
                  }
                }
              }
            }
          }
        }
      `
    }
    
    console.log('🔍 Trying GraphQL introspection...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(introspectionQuery)
    })
    
    if (response.ok) {
      const data = await response.json()
      
      // Find job-related types
      const jobTypes = data.data?.__schema?.types?.filter((type: any) => 
        type.name.toLowerCase().includes('job') || 
        type.name.toLowerCase().includes('search')
      )
      
      return NextResponse.json({
        success: true,
        method: 'graphql_introspection',
        jobTypesFound: jobTypes?.map((t: any) => t.name) || [],
        sampleType: jobTypes?.[0] || null,
        message: 'Introspection successful'
      })
    }
    
    // 2. If introspection fails, try known GraphQL queries
    const knownQueries = [
      {
        name: 'Simple Search',
        query: `query { searchJobs(first: 5) { edges { node { title } } } }`
      },
      {
        name: 'Find Jobs',
        query: `query { findJobs(filter: {}) { jobs { title } } }`
      },
      {
        name: 'Job Feed',
        query: `query { jobFeed { items { title } } }`
      },
      {
        name: 'Get Job Postings',
        query: `query { getJobPostings(limit: 5) { title } }`
      }
    ]
    
    for (const q of knownQueries) {
      try {
        const testRes = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ query: q.query })
        })
        
        if (testRes.ok) {
          const testData = await testRes.json()
          return NextResponse.json({
            success: true,
            method: 'known_query',
            queryName: q.name,
            response: testData,
            message: `Found working query: ${q.name}`
          })
        }
      } catch (e) {
        continue
      }
    }
    
    return NextResponse.json({
      success: false,
      message: 'Could not find working GraphQL schema'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    })
  }
}