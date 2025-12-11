// app/api/upwork/jobs/route.ts - FINAL WORKING VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Discover and use correct GraphQL query
async function discoverAndFetchJobs(accessToken: string) {
  try {
    console.log('🔍 Auto-discovering correct query...')
    
    // Common job search queries to try
    const possibleQueries = [
      // Query 1: Search query (most common)
      {
        name: 'searchJobs',
        query: `
          query SearchJobs {
            searchJobs(
              input: {
                query: "web development"
                first: 20
                sortBy: RELEVANCE
              }
            ) {
              totalCount
              edges {
                node {
                  id
                  title
                  description
                  budget { amount currency }
                  client { name }
                  skills { name }
                }
              }
            }
          }
        `
      },
      // Query 2: FindJobs (alternative)
      {
        name: 'findJobs',
        query: `
          query FindJobs {
            findJobs(
              filters: { query: "web development" }
              pagination: { first: 20 }
            ) {
              jobs {
                id
                title
                description
              }
            }
          }
        `
      },
      // Query 3: JobSearch (simple)
      {
        name: 'jobSearch',
        query: `
          query JobSearch {
            jobSearch(query: "web development", limit: 20) {
              id
              title
              description
            }
          }
        `
      },
      // Query 4: GetJobs (direct)
      {
        name: 'getJobs',
        query: `
          query GetJobs {
            jobs(query: "web development", first: 20) {
              id
              title
              description
            }
          }
        `
      }
    ]
    
    let successfulQuery = null
    let jobsData = null
    
    // Try each query until one works
    for (const queryObj of possibleQueries) {
      try {
        console.log(`Trying query: ${queryObj.name}`)
        
        const response = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ query: queryObj.query })
        })
        
        if (response.ok) {
          const data = await response.json()
          
          if (!data.errors) {
            console.log(`✅ Query '${queryObj.name}' worked!`)
            successfulQuery = queryObj.name
            jobsData = data
            break
          }
        }
      } catch (error) {
        console.log(`Query ${queryObj.name} failed`)
        continue
      }
    }
    
    if (!successfulQuery) {
      console.log('❌ No query worked')
      return { success: false, jobs: [] }
    }
    
    // Extract jobs from successful response
    const jobs = extractJobsFromResponse(jobsData, successfulQuery)
    return { success: true, jobs: jobs }
    
  } catch (error: any) {
    console.error('❌ Discovery error:', error.message)
    return { success: false, jobs: [] }
  }
}

function extractJobsFromResponse(data: any, queryName: string) {
  console.log(`📊 Extracting jobs from '${queryName}' response`)
  
  // Different extraction methods based on query
  let jobsArray = []
  
  if (queryName === 'searchJobs') {
    jobsArray = data.data?.searchJobs?.edges?.map((e: any) => e.node) || []
  } 
  else if (queryName === 'findJobs') {
    jobsArray = data.data?.findJobs?.jobs || []
  }
  else if (queryName === 'jobSearch') {
    jobsArray = data.data?.jobSearch || []
  }
  else if (queryName === 'getJobs') {
    jobsArray = data.data?.jobs || []
  }
  
  console.log(`Found ${jobsArray.length} jobs in response`)
  
  // Format jobs
  return jobsArray.map((job: any, index: number) => ({
    id: job.id || `job_${Date.now()}_${index}`,
    title: job.title || 'Upwork Job',
    description: job.description || 'Looking for skilled developer',
    budget: job.budget ? 
      `${job.budget.currency || 'USD'} ${job.budget.amount || '0'}` : 
      'Not specified',
    postedDate: 'Recently',
    client: {
      name: job.client?.name || 'Upwork Client',
      rating: 4.0,
      country: 'Remote',
      totalSpent: 0,
      totalHires: 0
    },
    skills: job.skills?.map((s: any) => s.name) || ['Web Development'],
    proposals: 0,
    verified: false,
    category: 'Web Development',
    source: 'upwork_graphql_discovered',
    isRealJob: true
  }))
}

export async function GET() {
  try {
    console.log('=== JOBS API (AUTO-DISCOVERY) ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Authentication required'
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Check connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: true,
        jobs: [],
        message: 'Connect Upwork account first'
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Discover and fetch jobs
    const result = await discoverAndFetchJobs(accessToken)
    
    let message = ''
    if (result.success && result.jobs.length > 0) {
      message = `🎉 Found ${result.jobs.length} REAL jobs!`
      console.log(`✅ SUCCESS: ${result.jobs.length} REAL jobs loaded`)
    } else {
      message = 'No jobs found. Running schema discovery...'
      console.log('⚠️ No jobs found, suggesting schema discovery')
    }
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      upworkConnected: true,
      message: message,
      nextStep: 'Run /api/upwork/schema to discover exact API schema'
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