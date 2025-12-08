// app/api/upwork/discover-schema/route.ts - NEW FILE
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

    // Get access token
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    if (upworkResult.rows.length === 0 || !upworkResult.rows[0].access_token) {
      return NextResponse.json({ 
        success: false, 
        message: 'No Upwork token found. Connect Upwork first.' 
      })
    }

    const accessToken = upworkResult.rows[0].access_token

    // ✅ INTROSPECTION QUERY - Yeh schema discover karega
    const introspectionQuery = {
      query: `
        query IntrospectionQuery {
          __schema {
            queryType {
              name
              fields {
                name
                description
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
            types {
              name
              kind
              fields {
                name
              }
            }
          }
        }
      `
    }

    console.log('🔍 Sending introspection query...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(introspectionQuery)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({
        success: false,
        error: `API error: ${response.status}`,
        details: errorText
      })
    }

    const data = await response.json()
    
    if (data.errors) {
      return NextResponse.json({
        success: false,
        errors: data.errors,
        message: 'Introspection query failed'
      })
    }

    // Find all query fields
    const queryFields = data.data?.__schema?.queryType?.fields || []
    
    // Find job-related types
    const allTypes = data.data?.__schema?.types || []
    const jobRelatedTypes = allTypes.filter((type: any) => 
      type.name.toLowerCase().includes('job') || 
      type.name.toLowerCase().includes('search') ||
      type.name.toLowerCase().includes('marketplace')
    )

    return NextResponse.json({
      success: true,
      availableQueryFields: queryFields.map((f: any) => f.name),
      jobRelatedTypes: jobRelatedTypes.map((t: any) => t.name),
      sampleQueryField: queryFields.find((f: any) => 
        f.name.toLowerCase().includes('job') || 
        f.name.toLowerCase().includes('search')
      ),
      message: 'Schema discovery complete'
    })

  } catch (error: any) {
    console.error('Discovery error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Failed to discover schema'
    })
  }
}