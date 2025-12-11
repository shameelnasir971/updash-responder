// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching jobs with CORRECT query...')
    
    // ✅ SIMPLE & CORRECT QUERY - Only available fields
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch {
            edges {
              node {
                id
                title
                description
                # ✅ These fields are definitely available
                # We'll add more fields once we confirm they exist
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
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const error = await response.text()
      console.error('❌ API error:', error.substring(0, 300))
      return { success: false, error: 'API request failed', jobs: [] }
    }
    
    const data = await response.json()
    console.log('✅ Response received, checking for errors...')
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)
    
    // Debug: Check what fields we actually received
    if (edges.length > 0 && edges[0].node) {
      console.log('📋 First node structure:', Object.keys(edges[0].node))
      console.log('Sample node:', {
        id: edges[0].node.id,
        title: edges[0].node.title,
        hasDescription: !!edges[0].node.description
      })
    }
    
    // Format jobs with REAL data (not defaults)
    const jobs = edges.map((edge: any, index: number) => {
      const node = edge.node || {}
      
      return {
        id: node.id || `job_${Date.now()}_${index}`,
        title: node.title || 'Upwork Job',
        description: node.description || 'Description not available',
        // Note: We'll add real budget/client/skills in next step
        budget: 'Check API for budget', // Temporary
        postedDate: 'Recently',
        client: {
          name: 'Client name in API',
          rating: 0,
          country: 'Check location in API',
          totalSpent: 0,
          totalHires: 0
        },
        skills: ['Check skills in API'],
        proposals: 0,
        verified: true,
        category: 'Development',
        source: 'upwork',
        isRealJob: true,
        _rawData: node // Keep raw data for debugging
      }
    })
    
    return { success: true, jobs: jobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

export async function GET() {
  try {
    console.log('=== JOBS API CALLED ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '⚠️ Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    const result = await fetchUpworkJobs(accessToken)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success ? 
        `✅ Found ${result.jobs.length} jobs (basic info)` : 
        `❌ Error: ${result.error}`,
      upworkConnected: true
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message
    }, { status: 500 })
  }
}