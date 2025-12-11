// app/api/upwork/jobs/route.ts - FINAL WORKING VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CORRECT QUERY FROM YOUR SCHEMA
async function fetchMarketplaceJobs(accessToken: string, tenantId: string | null) {
  try {
    console.log('🚀 Fetching REAL jobs via marketplaceJobPostingsSearch...')
    
    // ✅ THIS IS THE EXACT QUERY FROM YOUR SCHEMA
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch(
            input: {
              query: "web development"
              first: 20
              sortBy: RELEVANCE
              filters: {
                category: "web-mobile-software-dev"
                jobType: HOURLY_OR_FIXED_PRICE
              }
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
      `
    }
    
    // Build headers
    const headers: any = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
    // Add tenant ID if we have it
    if (tenantId) {
      headers['X-Upwork-API-TenantId'] = tenantId
      console.log('📤 Using Tenant ID:', tenantId.substring(0, 20) + '...')
    } else {
      console.log('📤 Trying without Tenant ID')
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ GraphQL error:', errorText.substring(0, 200))
      return { success: false, error: 'api_error', jobs: [] }
    }
    
    const data = await response.json()
    console.log('✅ GraphQL response received')
    
    // Check for errors
    if (data.errors) {
      console.error('❌ Query errors:', data.errors)
      return { success: false, error: 'query_error', jobs: [] }
    }
    
    // Extract jobs
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} REAL job edges`)
    
    if (edges.length === 0) {
      console.log('ℹ️ No jobs found (might be no matching jobs)')
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
        source: 'upwork_marketplace',
        isRealJob: true // ✅ REAL JOBS
      }
    })
    
    return { success: true, jobs: formattedJobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: 'fetch_error', jobs: [] }
  }
}

export async function GET() {
  try {
    console.log('=== REAL JOBS API (MARKETPLACE) ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Authentication required'
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Get access token and tenant ID
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
    
    // Fetch jobs using CORRECT query
    const result = await fetchMarketplaceJobs(accessToken, tenantId)
    
    let message = ''
    if (result.success) {
      if (result.jobs.length > 0) {
        message = `🎉 SUCCESS! Found ${result.jobs.length} REAL jobs from Upwork!`
        console.log(`✅ ${result.jobs.length} REAL JOBS LOADED!`)
      } else {
        message = 'No active jobs found in your category right now.'
        console.log('ℹ️ Query successful but no jobs returned')
      }
    } else {
      message = 'Error fetching jobs. Try reconnecting account.'
      console.log('❌ Job fetch failed')
    }
    
    console.log(`📊 Returning ${result.jobs.length} jobs`)
    console.log('=== JOBS API COMPLETED ===')
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      upworkConnected: true,
      message: message,
      debug: {
        queryUsed: 'marketplaceJobPostingsSearch',
        hasTenantId: !!tenantId,
        jobsCount: result.jobs.length
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