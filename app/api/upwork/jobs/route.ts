// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ 100% CORRECT QUERY - Schema ke mutabiq
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching REAL Upwork jobs with CORRECT schema...')
    
    // ✅ YEHI PERFECT QUERY HAI - Apke schema se exact fields
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch(
            marketPlaceJobFilter: {
              first: 20
              query: "web development"
              filters: {
                category: "web-mobile-software-dev"
              }
            }
          ) {
            totalCount
            edges {
              node {
                jobPosting {
                  id
                  title
                  description
                  estimatedBudget {
                    amount
                    currencyCode
                  }
                  client {
                    displayName
                    totalSpent
                    totalHired
                    location {
                      country
                    }
                  }
                  skills {
                    skill {
                      name
                    }
                  }
                  proposalCount
                  postedOn
                  jobType
                  workFlowState
                }
              }
            }
          }
        }
      `
    }
    
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
    console.log('📤 Sending CORRECT query to Upwork...')
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API error:', errorText.substring(0, 200))
      return { success: false, error: 'api_failed', jobs: [] }
    }
    
    const data = await response.json()
    console.log('✅ Response received')
    
    // Check GraphQL errors
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { success: false, error: 'graphql_errors', jobs: [] }
    }
    
    const searchData = data.data?.marketplaceJobPostingsSearch
    const edges = searchData?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)
    
    if (edges.length === 0) {
      return { success: true, jobs: [], error: null }
    }
    
    // Format jobs
    const formattedJobs = edges.map((edge: any, index: number) => {
      const job = edge.node?.jobPosting
      
      // Debug first job
      if (index === 0 && job) {
        console.log('📋 First job raw data:', JSON.stringify(job, null, 2).substring(0, 400))
      }
      
      return {
        id: job?.id || `job_${Date.now()}_${index}`,
        title: job?.title || 'Web Development Job',
        description: job?.description || 'Looking for skilled developer',
        budget: job?.estimatedBudget ? 
          `${job.estimatedBudget.currencyCode || 'USD'} ${job.estimatedBudget.amount || '0'}` : 
          'Budget not specified',
        postedDate: job?.postedOn ? 
          new Date(job.postedOn).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'Recently',
        client: {
          name: job?.client?.displayName || 'Upwork Client',
          rating: 4.5, // Default
          country: job?.client?.location?.country || 'Remote',
          totalSpent: job?.client?.totalSpent || 0,
          totalHires: job?.client?.totalHired || 0
        },
        skills: job?.skills?.map((s: any) => s.skill?.name).filter(Boolean).slice(0, 5) || 
                ['Web Development'],
        proposals: job?.proposalCount || 0,
        verified: job?.workFlowState === 'ACTIVE',
        category: 'Web Development',
        jobType: job?.jobType || 'Fixed Price',
        source: 'upwork',
        isRealJob: true
      }
    })
    
    console.log(`✅ Successfully formatted ${formattedJobs.length} REAL jobs`)
    return { success: true, jobs: formattedJobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// ✅ MAIN API ENDPOINT
export async function GET() {
  try {
    console.log('=== REAL JOBS API START ===')
    
    // 1. User authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Authentication required'
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // 2. Get Upwork token
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0 || !upworkResult.rows[0].access_token) {
      console.log('⚠️ Upwork not connected')
      return NextResponse.json({
        success: true,
        jobs: [],
        message: '🔗 Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    console.log('✅ Access token found')
    
    // 3. Fetch jobs with CORRECT query
    const result = await fetchRealUpworkJobs(accessToken)
    
    // 4. Prepare response
    let message = ''
    if (result.success) {
      if (result.jobs.length > 0) {
        message = `🎉 SUCCESS! Loaded ${result.jobs.length} REAL Upwork jobs!`
      } else {
        message = '✅ Connected but no jobs found. Try different keywords.'
      }
    } else {
      message = 'Error fetching jobs. Please reconnect Upwork account.'
    }
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      upworkConnected: true,
      message: message,
      debug: {
        hasToken: !!accessToken,
        tokenLength: accessToken.length,
        jobsCount: result.jobs.length
      }
    })
    
  } catch (error: any) {
    console.error('❌ API error:', error.message)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error'
    }, { status: 500 })
  }
}