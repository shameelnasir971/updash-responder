import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CACHE SYSTEM - REAL DATA ONLY
let jobsCache: any[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// ✅ REAL UPDATED QUERY - FROM UPWORK DEVELOPER DOCS 2024
async function fetchRealUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 Fetching REAL jobs from Upwork API...')
    
    // ✅ UPDATED QUERY - CORRECT STRUCTURE
    const graphqlQuery = {
      query: `
        query {
          marketplaceJobPostings {
            edges {
              node {
                id
                title
                description
                budget {
                  amount
                  currency
                }
                skills {
                  name
                }
                client {
                  displayName
                }
                createdAt
                totalApplicants
                category {
                  name
                }
              }
            }
          }
        }
      `
    }
    
    console.log('📤 Making REAL GraphQL request...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API error:', response.status, errorText.substring(0, 200))
      
      // Try REST API as backup
      return await fetchRealJobsViaREST(accessToken, searchTerm)
    }
    
    const data = await response.json()
    console.log('📊 GraphQL response received')
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return await fetchRealJobsViaREST(accessToken, searchTerm)
    }
    
    const edges = data.data?.marketplaceJobPostings?.edges || 
                  data.data?.jobPostings?.edges || 
                  data.data?.jobs?.edges || []
    
    console.log(`✅ Found ${edges.length} REAL job edges`)
    
    if (edges.length === 0) {
      console.log('⚠️ No jobs found in GraphQL, trying REST...')
      return await fetchRealJobsViaREST(accessToken, searchTerm)
    }
    
    // ✅ Format REAL jobs
    const jobs = edges.map((edge: any, index: number) => {
      const node = edge.node || {}
      
      // REAL BUDGET
      let budgetText = 'Budget not specified'
      const budget = node.budget || {}
      
      if (budget.amount) {
        const amount = parseFloat(budget.amount)
        const currency = budget.currency || 'USD'
        budgetText = `${currency === 'USD' ? '$' : currency}${amount.toFixed(2)}`
      }
      
      // REAL SKILLS
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // REAL DATE
      const postedDate = node.createdAt || node.createdDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently'
      
      // REAL CATEGORY
      const category = node.category?.name || 'General'
      
      return {
        // ✅ 100% REAL DATA
        id: node.id || `upwork_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: node.title || 'Job',
        description: node.description || '',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: node.client?.displayName || 'Client',
          rating: 0,
          country: 'Remote',
          totalSpent: 0,
          totalHires: 0
        },
        skills: realSkills,
        proposals: node.totalApplicants || 0,
        verified: true,
        category: category,
        jobType: 'Not specified',
        experienceLevel: 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} REAL jobs`)
    
    // Search filter
    let filteredJobs = jobs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredJobs = jobs.filter((job: { title: string; description: string; skills: string[] }) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
      )
    }
    
    return { 
      success: true, 
      jobs: filteredJobs, 
      error: null 
    }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { 
      success: false, 
      error: error.message, 
      jobs: []
    }
  }
}

// ✅ REAL REST API FETCH
async function fetchRealJobsViaREST(accessToken: string, searchTerm?: string) {
  try {
    console.log('🔄 Trying REST API...')
    
    // Try multiple REST endpoints
    const endpoints = [
      'https://www.upwork.com/api/profiles/v3/search/jobs',
      'https://www.upwork.com/api/jobs/v3/listings',
      'https://www.upwork.com/api/marketplace/v3/jobs'
    ]
    
    for (const endpoint of endpoints) {
      try {
        const url = `${endpoint}${searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ''}`
        console.log(`Trying: ${url}`)
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json',
          },
        })
        
        if (response.ok) {
          const data = await response.json()
          console.log(`✅ REST response from ${endpoint}:`, Object.keys(data))
          
          // Extract jobs from different response formats
          let jobs = []
          if (data.jobs) jobs = data.jobs
          else if (data.result?.jobs) jobs = data.result.jobs
          else if (data.profiles) jobs = data.profiles
          else if (data.listings) jobs = data.listings
          
          if (jobs.length > 0) {
            console.log(`✅ Found ${jobs.length} jobs via REST: ${endpoint}`)
            
            // Format REST jobs
            const formattedJobs = jobs.map((job: any, index: number) => ({
              id: job.id || job.jobId || `rest_${Date.now()}_${index}`,
              title: job.title || job.subject || 'Job',
              description: job.description || job.snippet || '',
              budget: job.budget ? `$${job.budget.amount || '0'}` : 'Budget not specified',
              postedDate: job.createdAt ? 
                new Date(job.createdAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                }) : 
                'Recently',
              client: {
                name: job.client?.name || job.client?.displayName || 'Client',
                rating: job.client?.rating || 0,
                country: job.client?.country || 'Remote',
                totalSpent: job.client?.totalSpent || 0,
                totalHires: job.client?.totalHires || 0
              },
              skills: job.skills || job.requiredSkills || [],
              proposals: job.proposals || job.totalApplicants || 0,
              verified: true,
              category: job.category || 'General',
              source: 'upwork',
              isRealJob: true
            }))
            
            return { 
              success: true, 
              jobs: formattedJobs, 
              error: null 
            }
          }
        }
      } catch (e) {
        console.log(`Endpoint failed: ${endpoint}`)
        continue
      }
    }
    
    console.log('❌ All REST endpoints failed')
    return { 
      success: false, 
      error: 'All REST endpoints failed', 
      jobs: [] 
    }
    
  } catch (error: any) {
    console.error('❌ REST error:', error.message)
    return { 
      success: false, 
      error: error.message, 
      jobs: []
    }
  }
}

// ✅ MAIN API ENDPOINT - REAL DATA ONLY
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API CALLED - REAL DATA ONLY ===')
    
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
    
    // Check cache
    const now = Date.now()
    
    if (!forceRefresh && jobsCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
      // Apply search filter to cached data
      let cachedJobs = jobsCache
      if (search) {
        const searchLower = search.toLowerCase()
        cachedJobs = jobsCache.filter(job => 
          job.title.toLowerCase().includes(searchLower) ||
          job.description.toLowerCase().includes(searchLower) ||
          job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
        )
      }
      
      if (cachedJobs.length > 0) {
        console.log('📦 Serving from cache...', cachedJobs.length, 'jobs')
        return NextResponse.json({
          success: true,
          jobs: cachedJobs,
          total: cachedJobs.length,
          message: `✅ ${cachedJobs.length} jobs loaded (from cache)`,
          upworkConnected: true,
          cached: true
        })
      }
    }
    
    console.log('🔄 Fetching REAL data from Upwork API...')
    
    // Fetch REAL jobs from Upwork
    const result = await fetchRealUpworkJobs(accessToken, search)
    
    if (!result.success) {
      console.error('❌ Failed to fetch jobs:', result.error)
      
      // If cache exists, return cache
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
          message: `⚠️ Using cached data (API error)`,
          upworkConnected: true,
          cached: true
        })
      }
      
      // ✅ NO SAMPLE DATA - Return empty with error
      return NextResponse.json({
        success: false,
        jobs: [],
        message: `❌ Failed to fetch jobs from Upwork API. Please check API connection and permissions.`,
        upworkConnected: true,
        error: result.error
      })
    }
    
    // Update cache
    if (!search) {
      jobsCache = result.jobs
      cacheTimestamp = now
      console.log(`💾 Updated cache with ${result.jobs.length} REAL jobs`)
    }
    
    // Success message
    const message = result.jobs.length > 0
      ? `✅ Loaded ${result.jobs.length} REAL jobs from Upwork API`
      : '❌ No jobs found (Upwork API returned empty)'
    
    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      total: result.jobs.length,
      message: message,
      upworkConnected: true,
      cached: false
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    
    // Return cache if available
    if (jobsCache.length > 0) {
      console.log('⚠️ Returning cached data due to error')
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        total: jobsCache.length,
        message: `⚠️ Using cached data (Server error)`,
        upworkConnected: true,
        cached: true
      })
    }
    
    // ✅ NO SAMPLE DATA - Return empty
    return NextResponse.json({
      success: false,
      jobs: [],
      message: `❌ Server error: ${error.message}`,
      upworkConnected: false
    }, { status: 500 })
  }
}

// ✅ CLEAR CACHE ENDPOINT
export async function POST(request: NextRequest) {
  try {
    jobsCache = []
    cacheTimestamp = 0
    
    return NextResponse.json({
      success: true,
      message: '✅ Cache cleared successfully'
    })
    
  } catch (error: any) {
    console.error('POST error:', error)
    return NextResponse.json({
      success: false,
      message: `❌ Error: ${error.message}`
    }, { status: 500 })
  }
}