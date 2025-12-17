import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const upworkResult = await pool.query(
      'SELECT access_token, upwork_user_id FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        user: user.email,
        upworkUserId: 'not_connected',
        tokenExists: false,
        apiTests: []
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    const upworkUserId = upworkResult.rows[0].upwork_user_id || 'unknown'
    const tokenPreview = accessToken.substring(0, 30) + '...'
    
    // Test different endpoints
    const testEndpoints = [
      {
        name: 'RSS Feed',
        endpoint: 'https://www.upwork.com/ab/feed/jobs/rss?q=web+development',
        method: 'GET'
      },
      {
        name: 'REST API Search',
        endpoint: 'https://www.upwork.com/api/profiles/v2/jobs/search.json?q=javascript',
        method: 'GET'
      },
      {
        name: 'GraphQL API',
        endpoint: 'https://api.upwork.com/graphql',
        method: 'POST',
        body: JSON.stringify({
          query: '{ __typename }'
        })
      },
      {
        name: 'Auth Info',
        endpoint: 'https://www.upwork.com/api/auth/v1/info.json',
        method: 'GET'
      }
    ]
    
    const results = []
    
    for (const test of testEndpoints) {
      try {
        const options: any = {
          method: test.method,
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        }
        
        if (test.method === 'POST' && test.body) {
          options.headers['Content-Type'] = 'application/json'
          options.body = test.body
        }
        
        const response = await fetch(test.endpoint, options)
        
        let data
        try {
          data = await response.json()
        } catch (e) {
          data = { text: await response.text() }
        }
        
        results.push({
          endpoint: test.endpoint,
          status: response.status,
          ok: response.ok,
          data: test.name === 'GraphQL API' ? { __typename: data?.data?.__typename } : data
        })
        
      } catch (error: any) {
        results.push({
          endpoint: test.endpoint,
          error: error.message
        })
      }
      
      // Delay between requests
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    
    return NextResponse.json({
      user: user.email,
      upworkUserId: upworkUserId,
      tokenExists: true,
      tokenPreview: tokenPreview,
      apiTests: results
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}