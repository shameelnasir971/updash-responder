// app/api/upwork/jobs/route.ts - FINAL WORKING VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Try GraphQL with AND without Tenant ID
async function fetchGraphQLJobs(accessToken: string, tenantId: string | null) {
  try {
    console.log('🚀 Fetching jobs via GraphQL...')
    
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
    
    // Try WITH Tenant ID first
    if (tenantId) {
      console.log('📤 Trying WITH Tenant ID:', tenantId.substring(0, 20) + '...')
      
      const response = await fetch('https://api.upwork.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Upwork-API-TenantId': tenantId
        },
        body: JSON.stringify(graphqlQuery)
      })
      
      console.log('📥 Response status (with Tenant ID):', response.status)
      
      if (response.ok) {
        const data = await response.json()
        
        if (data.errors) {
          console.log('GraphQL errors with Tenant ID:', data.errors[0]?.message)
        } else {
          const edges = data.data?.jobs?.marketplaceJobs?.edges || []
          console.log(`✅ Found ${edges.length} jobs WITH Tenant ID`)
          return formatJobs(edges)
        }
      }
    }
    
    // Try WITHOUT Tenant ID (some endpoints might work)
    console.log('🔄 Trying WITHOUT Tenant ID...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status (without Tenant ID):', response.status)
    
    if (response.ok) {
      const data = await response.json()
      
      if (data.errors) {
        console.log('GraphQL errors without Tenant ID:', data.errors[0]?.message)
        return []
      }
      
      const edges = data.data?.jobs?.marketplaceJobs?.edges || []
      console.log(`✅ Found ${edges.length} jobs WITHOUT Tenant ID`)
      return formatJobs(edges)
    }
    
    return []
    
  } catch (error: any) {
    console.error('❌ GraphQL error:', error.message)
    return []
  }
}

function formatJobs(edges: any[]) {
  return edges.map((edge: any) => {
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
      isRealJob: true
    }
  })
}

export async function GET() {
  try {
    console.log('=== REAL JOBS API CALLED (FINAL VERSION) ===')
    
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
    console.log('🔑 Tenant ID in DB:', tenantId || 'NOT FOUND')
    
    // Fetch jobs
    const jobs = await fetchGraphQLJobs(accessToken, tenantId)
    
    let message = ''
    if (jobs.length > 0) {
      message = `🎉 SUCCESS! Found ${jobs.length} REAL jobs from Upwork!`
      console.log(`🎯 ${jobs.length} REAL JOBS LOADED!`)
    } else {
      message = 'No jobs found. Try reconnecting Upwork account.'
      console.log('⚠️ No jobs returned')
    }
    
    console.log(`📊 Returning ${jobs.length} jobs`)
    console.log('=== JOBS API COMPLETED ===')
    
    return NextResponse.json({
      success: true,
      jobs: jobs,
      total: jobs.length,
      upworkConnected: true,
      message: message,
      debug: {
        hasTenantId: !!tenantId,
        jobsCount: jobs.length,
        accessTokenPreview: accessToken.substring(0, 30) + '...'
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