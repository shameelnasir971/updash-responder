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

    // SIMPLE INTROSPECTION QUERY
    const introspectionQuery = {
      query: `
        query {
          __schema {
            queryType {
              name
              fields {
                name
              }
            }
          }
        }
      `
    }

    console.log('🔍 Sending simple introspection query...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(introspectionQuery)
    })

    const data = await response.json()
    
    if (data.errors) {
      return NextResponse.json({
        success: false,
        errors: data.errors,
        message: 'Introspection failed'
      })
    }

    const queryFields = data.data?.__schema?.queryType?.fields || []
    
    return NextResponse.json({
      success: true,
      availableQueries: queryFields.map((f: any) => f.name),
      message: 'Discovery complete. Look for job/search related queries.'
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}
