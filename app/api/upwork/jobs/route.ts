// app/api/upwork/jobs/route.ts - FINAL WORKING VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ REAL GRAPHQL JOBS QUERY
async function fetchJobsViaGraphQL(accessToken: string, tenantId: string) {
  try {
    console.log('🚀 Fetching REAL jobs via GraphQL...')
    
    // ✅ CORRECT GraphQL query for marketplace jobs
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          jobs {
            marketplaceJobs(
              first: 20
              sort: POSTED_DATE_DESC
              filters: {
                category: "web-mobile-software-dev"
                jobType: HOURLY_OR_FIXED_PRICE
              }
            ) {
              totalCount
              edges {
                node {
                  id
                  title
                  description
                  budget {
                    amount
                    currency
                  }
                  client {
                    displayName
                    feedback
                    location {
                      country
                    }
                  }
                  skills {
                    name
                  }
                  proposalCount
                  isVerified
                  postedOn
                  jobType
                }
              }
            }
          }
        }
      `
    }
    
    // ✅ MUST include tenant ID header
    const headers: any = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
    if (tenantId) {
      headers['X-Upwork-API-TenantId'] = tenantId
    }
    
    console.log('📤 Sending GraphQL request with tenant:', tenantId ? 'YES' : 'NO')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ GraphQL error:', errorText)
      return { success: false, error: 'graphql_error', jobs: [] }
    }
    
    const data = await response.json()
    console.log('✅ GraphQL response received')
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('❌ GraphQL query errors:', data.errors)
      return { success: false, error: 'query_error', jobs: [] }
    }
    
    // Extract jobs
    const edges = data.data?.jobs?.marketplaceJobs?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)
    
    if (edges.length === 0) {
      console.log('ℹ️ No jobs found in response')
      return { success: true, jobs: [], error: null }
    }
    
    // Format jobs
    const formattedJobs = edges.map((edge: any) => {
      const job = edge.node
      return {
        id: job.id || `job_${Date.now()}`,
        title: job.title || 'Web Development Job',
        description: job.description || 'Looking for skilled developer',
        budget: job.budget ? 
          `${job.budget.currency || 'USD'} ${job.budget.amount || '0'}` : 
          'Not specified',
        postedDate: job.postedOn ? 
          new Date(job.postedOn).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'Recently',
        client: {
          name: job.client?.displayName || 'Upwork Client',
          rating: job.client?.feedback || 4.0,
          country: job.client?.location?.country || 'Remote',
          totalSpent: 0,
          totalHires: 0
        },
        skills: job.skills?.map((s: any) => s.name).slice(0, 5) || ['Web Development'],
        proposals: job.proposalCount || 0,
        verified: job.isVerified || false,
        category: 'Web Development',
        jobType: job.jobType || 'Fixed Price',
        source: 'upwork_graphql',
        isRealJob: true // ✅ REAL JOBS
      }
    })
    
    return { success: true, jobs: formattedJobs, error: null }
    
  } catch (error: any) {
    console.error('❌ GraphQL fetch error:', error.message)
    return { success: false, error: 'fetch_error', jobs: [] }
  }
}

// ✅ GET - Fetch jobs (MAIN FUNCTION)
export async function GET() {
  try {
    console.log('=== REAL JOBS API CALLED (GRAPHQL) ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'User not authenticated'
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Get access token AND tenant ID
    const upworkResult = await pool.query(
      'SELECT access_token, upwork_user_id FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0 || !upworkResult.rows[0].access_token) {
      console.log('⚠️ No Upwork connection')
      return NextResponse.json({
        success: true,
        jobs: [],
        message: '🔗 Connect Upwork account first'
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    const tenantId = upworkResult.rows[0].upwork_user_id
    
    console.log('✅ Access token found')
    console.log('🔑 Tenant ID:', tenantId || 'NOT FOUND')
    
    // Fetch jobs via GraphQL
    let jobs = []
    let message = ''
    
    if (tenantId) {
      console.log('🚀 Using GraphQL with Tenant ID...')
      const result = await fetchJobsViaGraphQL(accessToken, tenantId)
      
      if (result.success) {
        jobs = result.jobs
        message = result.jobs.length > 0 
          ? `✅ Found ${result.jobs.length} REAL jobs from Upwork!` 
          : 'No active jobs found in your category right now.'
      } else {
        message = 'Error fetching jobs from Upwork'
      }
    } else {
      message = '⚠️ Please reconnect Upwork account (Tenant ID missing)'
      console.log('⚠️ No tenant ID in database')
    }
    
    console.log(`📊 Returning ${jobs.length} jobs`)
    console.log('=== JOBS API COMPLETED ===')
    
    return NextResponse.json({
      success: true,
      jobs: jobs, // Real jobs or empty array
      total: jobs.length,
      upworkConnected: true,
      message: message,
      debug: {
        hasTenantId: !!tenantId,
        jobsCount: jobs.length
      }
    })
    
  } catch (error: any) {
    console.error('❌ Jobs API error:', error.message)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error'
    }, { status: 500 })
  }
}