// app/api/upwork/test-api/route.ts - NEW FILE
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
        connected: false,
        message: 'No Upwork account connected'
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Test different endpoints
    const testEndpoints = [
      {
        name: 'Profiles V2',
        url: 'https://www.upwork.com/api/profiles/v2/search/jobs.json?q=javascript'
      },
      {
        name: 'Jobs V2',
        url: 'https://www.upwork.com/api/jobs/v2/listings.json?q=web'
      },
      {
        name: 'Public Feed',
        url: 'https://www.upwork.com/ab/find-work/api/feeds/jobs/search?q=development'
      }
    ]
    
    const results = []
    
    for (const endpoint of testEndpoints) {
      try {
        const response = await fetch(endpoint.url, {
          headers: endpoint.name === 'Public Feed' ? {
            'User-Agent': 'Mozilla/5.0'
          } : {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        })
        
        const status = response.status
        let data = {}
        
        if (response.ok) {
          data = await response.json()
        }
        
        results.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          status,
          success: response.ok,
          dataType: typeof data,
          keys: Object.keys(data),
          sample: JSON.stringify(data).substring(0, 200)
        })
      } catch (error: any) {
        results.push({
          endpoint: endpoint.name,
          url: endpoint.url,
          error: error.message,
          success: false
        })
      }
    }
    
    return NextResponse.json({
      connected: true,
      tokenPresent: true,
      tokenPreview: accessToken.substring(0, 30) + '...',
      results
    })
    
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      stack: error.stack
    })
  }
}