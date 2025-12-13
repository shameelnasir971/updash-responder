import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'

export async function GET() {
  try {
    const result = await pool.query('SELECT access_token FROM upwork_accounts LIMIT 1')
    
    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'No Upwork connection' })
    }
    
    const accessToken = result.rows[0].access_token
    
    // Exact same query as debug endpoint
    const testQuery = {
      query: `
        query TestReal {
          marketplaceJobPostingsSearch {
            totalCount
            edges {
              node {
                id
                title
                description
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
      body: JSON.stringify(testQuery)
    })
    
    if (!response.ok) {
      return NextResponse.json({
        error: 'API call failed',
        status: response.status
      })
    }
    
    const data = await response.json()
    
    // Format some real jobs
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    const sampleJobs = edges.slice(0, 5).map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      description: edge.node.description?.substring(0, 100) || 'No description',
      isReal: true
    }))
    
    return NextResponse.json({
      success: true,
      tokenValid: true,
      totalJobs: data.data?.marketplaceJobPostingsSearch?.totalCount,
      sampleJobs: sampleJobs,
      edgesCount: edges.length
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      success: false
    })
  }
}