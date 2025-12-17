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
    
    const upworkResult = await pool.query(
      'SELECT access_token, upwork_user_id FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({ error: 'No Upwork connection' })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    const upworkUserId = upworkResult.rows[0].upwork_user_id
    
    // Test multiple endpoints
    const endpoints = [
      {
        url: 'https://www.upwork.com/ab/feed/jobs/rss?q=web+development',
        method: 'GET'
      },
      {
        url: 'https://www.upwork.com/api/profiles/v2/jobs/search.json?q=javascript',
        method: 'GET'
      },
      {
        url: 'https://api.upwork.com/graphql',
        method: 'POST',
        body: JSON.stringify({ query: '{ __typename }' }) // Simple test query
      },
      {
        url: 'https://www.upwork.com/api/auth/v1/info.json',
        method: 'GET'
      }
    ]
    
    const results = []
    
    for (const endpoint of endpoints) {
      try {
        const headers: any = {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
        
        const options: any = {
          method: endpoint.method,
          headers
        }
        
        if (endpoint.body) {
          headers['Content-Type'] = 'application/json'
          options.body = endpoint.body
        }
        
        const response = await fetch(endpoint.url, options)
        
        let data = null
        try {
          data = await response.json()
        } catch {
          data = await response.text()
        }
        
        results.push({
          endpoint: endpoint.url,
          status: response.status,
          ok: response.ok,
          data: typeof data === 'string' ? data.substring(0, 500) + '...' : data
        })
      } catch (e: any) {
        results.push({
          endpoint: endpoint.url,
          error: e.message
        })
      }
    }
    
    return NextResponse.json({
      user: user.email,
      upworkUserId: upworkUserId,
      tokenExists: !!accessToken,
      tokenPreview: accessToken ? `${accessToken.substring(0, 20)}...` : 'No token',
      apiTests: results
    })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}