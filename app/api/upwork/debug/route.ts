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

    // Check database connection
    const dbCheck = await pool.query('SELECT NOW() as time')
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT id, created_at FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    // Test simple GraphQL query
    let graphqlTest = null
    if (upworkResult.rows.length > 0) {
      const accessToken = upworkResult.rows[0].access_token
      
      const testQuery = {
        query: `query { __typename }`
      }
      
      try {
        const response = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(testQuery)
        })
        
        graphqlTest = {
          status: response.status,
          ok: response.ok
        }
      } catch (error: any) {
        graphqlTest = { error: error.message }
      }
    }

    return NextResponse.json({
      success: true,
      user: {
        email: user.email,
        id: user.id
      },
      database: {
        connected: true,
        time: dbCheck.rows[0]?.time
      },
      upwork: {
        connected: upworkResult.rows.length > 0,
        accounts: upworkResult.rows.length,
        graphqlTest: graphqlTest
      },
      instructions: [
        '1. First run: GET /api/upwork/explore-schema to find correct query',
        '2. Then run: GET /api/upwork/jobs to get real jobs',
        '3. Check console for detailed logs'
      ]
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}