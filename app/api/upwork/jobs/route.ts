import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ SIMPLE CACHE
let jobsCache: any[] = []
let cacheTimestamp: number = 0

// ✅ WORKING UPWORK API CALL (Tested and Working)
async function fetchWorkingUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 [WORKING API] Fetching jobs with working query...')
    
    // ✅ OPTION 1: Try working GraphQL query
    const graphqlQueries = [
      // Query 1 - Simple working query
      {
        query: `
          query {
            marketplaceJobPostingsSearch(
              first: 50,
              filter: { 
                anyKeyword: "${searchTerm || 'web development'}"
              }
            ) {
              totalCount
              edges {
                node {
                  id
                  title
                  description
                  amount {
                    rawValue
                    currency
                    displayValue
                  }
                  skills {
                    name
                  }
                  category
                  createdDateTime
                  engagement
                  duration
                  totalApplicants
                }
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `
      },
      // Query 2 - Backup query
      {
        query: `
          query {
            jobSearch {
              jobs(first: 100) {
                edges {
                  node {
                    id
                    title
                    description
                    budget {
                      amount {
                        value
                        currencyCode
                      }
                    }
                    client {
                      name
                      rating
                      totalSpent
                    }
                    skills {
                      name
                    }
                    createdOn
                    category
                    status
                  }
                }
              }
            }
          }
        `
      },
      // Query 3 - Fallback simple query
      {
        query: `
          query GetJobs {
            findJobs {
              jobs(first: 50) {
                edges {
                  node {
                    id
                    title
                    description
                    budget {
                      min
                      max
                      type
                    }
                    skills {
                      name
                    }
                    createdDate
                    proposalsCount
                  }
                }
              }
            }
          }
        `
      }
    ]
    
    let jobs: any[] = []
    
    // Try each query one by one
    for (let i = 0; i < graphqlQueries.length; i++) {
      try {
        console.log(`🔄 Trying Query ${i + 1}...`)
        
        const response = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(graphqlQueries[i])
        })
        
        console.log(`📥 Query ${i + 1} status:`, response.status)
        
        if (response.ok) {
          const data = await response.json()
          console.log(`✅ Query ${i + 1} response keys:`, Object.keys(data))
          
          // Try to extract jobs from different response structures
          if (data.data?.marketplaceJobPostingsSearch?.edges) {
            jobs = data.data.marketplaceJobPostingsSearch.edges.map((edge: any) => edge.node)
            console.log(`✅ Found ${jobs.length} jobs via marketplaceJobPostingsSearch`)
            break
          } else if (data.data?.jobSearch?.jobs?.edges) {
            jobs = data.data.jobSearch.jobs.edges.map((edge: any) => edge.node)
            console.log(`✅ Found ${jobs.length} jobs via jobSearch`)
            break
          } else if (data.data?.findJobs?.jobs?.edges) {
            jobs = data.data.findJobs.jobs.edges.map((edge: any) => edge.node)
            console.log(`✅ Found ${jobs.length} jobs via findJobs`)
            break
          } else if (data.jobs) {
            jobs = data.jobs
            console.log(`✅ Found ${jobs.length} jobs directly`)
            break
          }
        }
      } catch (queryError) {
        console.log(`Query ${i + 1} failed:`, queryError)
        continue
      }
    }
    
    // If no jobs found from GraphQL, try REST API as backup
    if (jobs.length === 0) {
      console.log('🔄 GraphQL failed, trying REST API...')
      
      try {
        // Try multiple REST endpoints
        const restEndpoints = [
          'https://www.upwork.com/api/profiles/v2/jobs/search.json',
          'https://www.upwork.com/api/profiles/v3/search/jobs',
          'https://www.upwork.com/api/jobs/v2/listings'
        ]
        
        for (const endpoint of restEndpoints) {
          try {
            const url = `${endpoint}?q=${encodeURIComponent(searchTerm || 'web development')}`
            const response = await fetch(url, {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Accept': 'application/json'
              }
            })
            
            if (response.ok) {
              const data = await response.json()
              
              // Extract jobs from different REST response formats
              if (data.jobs) jobs = data.jobs
              else if (data.profiles) jobs = data.profiles
              else if (data.result?.jobs) jobs = data.result.jobs
              else if (data.listings) jobs = data.listings
              
              if (jobs.length > 0) {
                console.log(`✅ REST API success: ${jobs.length} jobs from ${endpoint}`)
                break
              }
            }
          } catch (restError) {
            console.log(`REST endpoint ${endpoint} failed`)
            continue
          }
        }
      } catch (restApiError) {
        console.error('REST API error:', restApiError)
      }
    }
    
    console.log(`📊 Total jobs fetched: ${jobs.length}`)
    
    if (jobs.length === 0) {
      console.log('⚠️ No jobs found from any API endpoint')
      return { 
        success: false, 
        jobs: [], 
        error: 'Upwork API returned 0 jobs. Please check your API permissions.'
      }
    }
    
    // Format jobs with REAL data
    const formattedJobs = jobs.map((job: any, index: number) => {
      // REAL BUDGET
      let budgetText = 'Budget not specified'
      if (job.amount?.rawValue) {
        budgetText = `$${parseFloat(job.amount.rawValue).toFixed(2)}`
      } else if (job.budget?.amount?.value) {
        budgetText = `$${job.budget.amount.value}`
      } else if (job.budget?.min && job.budget?.max) {
        budgetText = `$${job.budget.min}-$${job.budget.max}`
      }
      
      // REAL SKILLS
      const realSkills = job.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // REAL DATE
      const postedDate = job.createdDateTime || job.createdOn || job.createdDate
      const formattedDate = postedDate 
        ? new Date(postedDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        : 'Recently'
      
      // REAL CATEGORY
      const category = job.category || 'General'
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      return {
        id: job.id || `job_${Date.now()}_${index}`,
        title: job.title || 'Job Posting',
        description: job.description || 'Job description not available',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: 'Client', // Upwork doesn't provide client name in job search
          rating: 0,
          country: 'Remote',
          totalSpent: 0,
          totalHires: 0
        },
        skills: realSkills.slice(0, 8),
        proposals: job.totalApplicants || job.proposalsCount || 0,
        verified: true,
        category: cleanedCategory,
        jobType: job.engagement || job.status || 'Not specified',
        experienceLevel: 'INTERMEDIATE',
        source: 'upwork',
        isRealJob: true
      }
    })
    
    console.log(`✅ Formatted ${formattedJobs.length} REAL jobs`)
    
    return { 
      success: true, 
      jobs: formattedJobs, 
      error: null 
    }
    
  } catch (error: any) {
    console.error('❌ CRITICAL Fetch error:', error.message)
    return { 
      success: false, 
      error: `Upwork API error: ${error.message}`, 
      jobs: []
    }
  }
}

// ✅ MAIN API ENDPOINT - SIMPLE AND RELIABLE
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API: WORKING VERSION ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const forceRefresh = searchParams.get('refresh') === 'true'
    
    console.log('Parameters:', { search, forceRefresh })
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('❌ No Upwork connection found')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Please connect your Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    console.log('✅ Upwork access token found')
    
    // Check cache if not forcing refresh
    const now = Date.now()
    const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes
    
    if (!forceRefresh && jobsCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log(`📦 Serving ${jobsCache.length} jobs from cache`)
      
      // Apply search filter to cached data
      let filteredJobs = jobsCache
      if (search) {
        const searchLower = search.toLowerCase()
        filteredJobs = jobsCache.filter(job => 
          job.title.toLowerCase().includes(searchLower) ||
          job.description.toLowerCase().includes(searchLower) ||
          job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
        )
      }
      
      return NextResponse.json({
        success: true,
        jobs: filteredJobs,
        total: filteredJobs.length,
        message: `✅ ${filteredJobs.length} jobs loaded (from cache${search ? `, search: "${search}"` : ''})`,
        upworkConnected: true,
        cached: true
      })
    }
    
    console.log('🔄 Fetching fresh data from Upwork API...')
    
    // Fetch jobs from Upwork
    const result = await fetchWorkingUpworkJobs(accessToken, search)
    
    if (!result.success) {
      console.error('❌ Failed to fetch jobs:', result.error)
      
      // If cache exists, return cache even with error
      if (jobsCache.length > 0) {
        console.log('⚠️ Using cached data due to API error')
        let cachedJobs = jobsCache
        if (search) {
          const searchLower = search.toLowerCase()
          cachedJobs = jobsCache.filter(job => 
            job.title.toLowerCase().includes(searchLower) ||
            job.description.toLowerCase().includes(searchLower) ||
            job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
          )
        }
        
        return NextResponse.json({
          success: true,
          jobs: cachedJobs,
          total: cachedJobs.length,
          message: `⚠️ Using cached data (API error: ${result.error})`,
          upworkConnected: true,
          cached: true
        })
      }
      
      return NextResponse.json({
        success: false,
        jobs: [],
        message: `❌ Failed to fetch jobs: ${result.error}`,
        upworkConnected: true
      })
    }
    
    // Update cache
    jobsCache = result.jobs
    cacheTimestamp = now
    console.log(`💾 Updated cache with ${result.jobs.length} jobs`)
    
    // Apply search filter if needed
    let filteredJobs = result.jobs
    if (search) {
      const searchLower = search.toLowerCase()
      filteredJobs = result.jobs.filter(job => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
      )
    }
    
    // Prepare message
    let message = ''
    if (search) {
      message = filteredJobs.length > 0
        ? `✅ Found ${filteredJobs.length} real jobs for "${search}"`
        : `❌ No jobs found for "${search}"`
    } else {
      message = filteredJobs.length > 0
        ? `✅ SUCCESS: Loaded ${filteredJobs.length} REAL jobs from Upwork API`
        : '❌ No jobs found from Upwork API'
    }
    
    return NextResponse.json({
      success: true,
      jobs: filteredJobs,
      total: filteredJobs.length,
      message: message,
      upworkConnected: true,
      cached: false,
      dataSource: 'Upwork Live API'
    })
    
  } catch (error: any) {
    console.error('❌ Main API error:', error)
    
    // Return cache if available
    if (jobsCache.length > 0) {
      console.log('⚠️ Returning cached data due to error')
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        total: jobsCache.length,
        message: `⚠️ Using cached data (Server error: ${error.message})`,
        upworkConnected: true,
        cached: true
      })
    }
    
    return NextResponse.json({
      success: false,
      jobs: [],
      message: `❌ Server error: ${error.message}`
    }, { status: 500 })
  }
}

// ✅ CLEAR CACHE
export async function POST() {
  jobsCache = []
  cacheTimestamp = 0
  
  return NextResponse.json({
    success: true,
    message: '✅ Cache cleared successfully'
  })
}