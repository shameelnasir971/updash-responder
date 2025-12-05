// app/api/upwork/test-jobs/route.ts
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

    // Get access token
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    if (!upworkResult.rows[0]?.access_token) {
      return NextResponse.json({ 
        success: false, 
        message: 'No token found' 
      })
    }

    const accessToken = upworkResult.rows[0].access_token
    
    // Test GraphQL API
    const gqlResponse = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `query { 
          findJobs(filter: { status: "open" }, paging: { first: 5 }) { 
            nodes { 
              id 
              title 
            } 
            totalCount 
          } 
        }`
      })
    })

    const gqlData = await gqlResponse.json()
    
    // Test REST API as alternative
    const restResponse = await fetch(
      'https://www.upwork.com/api/profiles/v3/search/jobs?q=web%20development&t=0&sort=recency&paging=0;5',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'X-Upwork-API-TenantId': 'api',
        }
      }
    )
    
    const restData = await restResponse.text()
    
    return NextResponse.json({
      success: true,
      tokenPreview: accessToken.substring(0, 30) + '...',
      tokenLength: accessToken.length,
      gqlStatus: gqlResponse.status,
      gqlData: gqlData,
      restStatus: restResponse.status,
      restDataPreview: restData.substring(0, 500),
      debug: {
        gqlHasJobs: gqlData?.data?.findJobs?.nodes?.length || 0,
        restHasJobs: restData.includes('"jobs"') || restData.includes('"profiles"')
      }
    })

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}