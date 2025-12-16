import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Global variables for background refresh
let lastRefreshTime = 0
let refreshInProgress = false

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // Check if refresh is needed (every 5 minutes)
    const now = Date.now()
    const timeSinceLastRefresh = now - lastRefreshTime
    const refreshInterval = 5 * 60 * 1000 // 5 minutes
    
    if (refreshInProgress) {
      return NextResponse.json({
        success: true,
        refreshing: true,
        message: 'Refresh already in progress'
      })
    }
    
    if (timeSinceLastRefresh < refreshInterval) {
      return NextResponse.json({
        success: true,
        refreshing: false,
        message: `Next refresh in ${Math.round((refreshInterval - timeSinceLastRefresh) / 1000 / 60)} minutes`,
        lastRefresh: new Date(lastRefreshTime).toLocaleTimeString()
      })
    }
    
    // Start background refresh
    refreshInProgress = true
    console.log('🔄 Starting background job refresh...')
    
    // Don't wait for completion - return immediately
    backgroundRefreshJobs(user.id)
    
    return NextResponse.json({
      success: true,
      refreshing: true,
      message: 'Background refresh started',
      startedAt: new Date().toLocaleTimeString()
    })
    
  } catch (error: any) {
    console.error('Refresh error:', error.message)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

// Background function to refresh jobs
async function backgroundRefreshJobs(userId: number) {
  try {
    // Get access token
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [userId]
    )
    
    if (upworkResult.rows.length === 0) {
      refreshInProgress = false
      return
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Fetch new jobs
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: `
          query GetNewJobs {
            marketplaceJobPostingsSearch {
              edges {
                node {
                  id
                  title
                  description
                  amount { rawValue currency displayValue }
                  skills { name }
                  totalApplicants
                  category
                  createdDateTime
                }
              }
            }
          }
        `
      })
    })
    
    if (response.ok) {
      const data = await response.json()
      const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
      
      console.log(`✅ Background refresh: ${edges.length} new jobs fetched`)
      
      // Store in database for later retrieval
      for (const edge of edges.slice(0, 50)) { // Limit to 50 new jobs
        const node = edge.node || {}
        
        await pool.query(
          `INSERT INTO upwork_jobs_cache 
           (job_id, title, description, budget, skills, category, posted_at, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
           ON CONFLICT (job_id) DO NOTHING`,
          [
            node.id,
            node.title,
            node.description,
            node.amount?.displayValue || 'Not specified',
            node.skills?.map((s: any) => s.name).join(',') || '',
            node.category || 'General',
            node.createdDateTime || new Date()
          ]
        )
      }
      
      console.log('✅ New jobs stored in cache')
    }
    
    lastRefreshTime = Date.now()
    refreshInProgress = false
    
  } catch (error: any) {
    console.error('Background refresh error:', error.message)
    refreshInProgress = false
  }
}

// Endpoint to get recently added jobs
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { hours = 24 } = await request.json()
    
    // Get jobs added in last X hours
    const result = await pool.query(
      `SELECT job_id, title, description, budget, category, posted_at 
       FROM upwork_jobs_cache 
       WHERE created_at >= NOW() - INTERVAL '${hours} hours'
       ORDER BY created_at DESC
       LIMIT 100`
    )
    
    return NextResponse.json({
      success: true,
      jobs: result.rows,
      count: result.rows.length,
      message: `Found ${result.rows.length} jobs added in last ${hours} hours`
    })
    
  } catch (error: any) {
    console.error('Recent jobs error:', error.message)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}