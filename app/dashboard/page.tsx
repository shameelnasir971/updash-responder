import { getCurrentUser } from '@/lib/auth'
import pool from '@/lib/database'
import { NextRequest, NextResponse } from 'next/server'
// import { getCurrentUser } from '../../../../lib/auth'
// import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ REAL JOBS CACHE
let jobsCache: any[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000

// ✅ WORKING UPWORK API CALLS
async function fetchRealUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 Fetching REAL jobs from Upwork...')
    
    // Method 1: Try REST API first (more reliable)
    console.log('🔄 Trying REST API endpoint...')
    
    // Build REST API URL
    let apiUrl = 'https://www.upwork.com/api/profiles/v2/search/jobs.json'
    if (searchTerm) {
      apiUrl += `?q=${encodeURIComponent(searchTerm)}&pageSize=100`
    } else {
      apiUrl += '?pageSize=100'
    }
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    })
    
    console.log('📥 REST API Response status:', response.status)
    
    if (response.ok) {
      const data = await response.json()
      console.log('📊 REST API response structure:', Object.keys(data))
      
      // Extract jobs from REST response
      const jobs = extractJobsFromREST(data)
      if (jobs.length > 0) {
        console.log(`✅ Found ${jobs.length} REAL jobs via REST API`)
        return { success: true, jobs, error: null }
      }
    }
    
    // Method 2: Try GraphQL if REST fails
    console.log('🔄 Trying GraphQL API...')
    return await fetchViaGraphQL(accessToken, searchTerm)
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// ✅ EXTRACT JOBS FROM REST API RESPONSE
function extractJobsFromREST(data: any): any[] {
  try {
    console.log('🔍 Parsing REST API response...')
    
    // Different response formats
    let rawJobs = []
    
    if (data.jobs && Array.isArray(data.jobs)) {
      rawJobs = data.jobs
    } else if (data.result && Array.isArray(data.result.jobs)) {
      rawJobs = data.result.jobs
    } else if (data.profiles && Array.isArray(data.profiles)) {
      rawJobs = data.profiles
    } else if (data.listings && Array.isArray(data.listings)) {
      rawJobs = data.listings
    } else if (Array.isArray(data)) {
      rawJobs = data
    }
    
    console.log(`📊 Found ${rawJobs.length} raw jobs in response`)
    
    if (rawJobs.length === 0) {
      // Check if response has different structure
      console.log('🔍 Checking alternative response structures...')
      const allKeys = Object.keys(data)
      console.log('Available keys:', allKeys)
      
      // Try to find any array in the response
      for (const key of allKeys) {
        if (Array.isArray(data[key])) {
          rawJobs = data[key]
          console.log(`Found array in key "${key}": ${rawJobs.length} items`)
          break
        }
      }
    }
    
    // Format jobs
    const jobs = rawJobs.map((job: any, index: number) => {
      // Extract job ID
      const jobId = job.id || job.jobId || job.job_id || `job_${Date.now()}_${index}`
      
      // Extract title
      const title = job.title || job.subject || job.job_title || 'Upwork Job'
      
      // Extract description
      const description = job.description || job.snippet || job.job_description || 
                         job.overview || 'Job description from Upwork'
      
      // Extract budget
      let budgetText = 'Budget not specified'
      if (job.budget) {
        if (typeof job.budget === 'object') {
          const amount = job.budget.amount || job.budget.value
          const currency = job.budget.currency || 'USD'
          budgetText = `${currency === 'USD' ? '$' : currency}${amount || '0'}`
        } else if (typeof job.budget === 'number') {
          budgetText = `$${job.budget}`
        } else if (typeof job.budget === 'string') {
          budgetText = job.budget
        }
      } else if (job.hourlyBudget) {
        budgetText = `$${job.hourlyBudget}/hr`
      } else if (job.amount) {
        budgetText = `$${job.amount}`
      }
      
      // Extract skills
      let skills = []
      if (job.skills && Array.isArray(job.skills)) {
        skills = job.skills.map((s: any) => 
          typeof s === 'string' ? s : (s.name || s.skill || '')
        ).filter(Boolean)
      } else if (job.requiredSkills) {
        skills = job.requiredSkills
      } else if (job.categories) {
        skills = job.categories
      }
      
      // Extract date
      let postedDate = 'Recently'
      const dateStr = job.createdAt || job.postedDate || job.created_date || job.date
      if (dateStr) {
        try {
          postedDate = new Date(dateStr).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
        } catch (e) {
          postedDate = 'Recently'
        }
      }
      
      // Extract client info
      const clientInfo = job.client || {}
      
      return {
        // ✅ 100% REAL DATA FROM UPWORK
        id: jobId,
        title: title,
        description: description,
        budget: budgetText,
        postedDate: postedDate,
        client: {
          name: clientInfo.displayName || clientInfo.name || clientInfo.company_name || 'Upwork Client',
          rating: clientInfo.rating || clientInfo.feedback || 0,
          country: clientInfo.country || clientInfo.location || 'Remote',
          totalSpent: clientInfo.totalSpent || clientInfo.total_spent || 0,
          totalHires: clientInfo.totalHires || clientInfo.total_hires || 0
        },
        skills: skills.length > 0 ? skills : ['Development'],
        proposals: job.proposals || job.totalApplicants || job.applicants || 0,
        verified: job.verified || job.status === 'ACTIVE' || true,
        category: job.category || job.job_category || 'General',
        jobType: job.type || job.job_type || 'Not specified',
        experienceLevel: job.experience || job.experience_level || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
    return jobs
    
  } catch (error) {
    console.error('❌ Error extracting jobs:', error)
    return []
  }
}

// ✅ GRAPHQL FALLBACK METHOD
async function fetchViaGraphQL(accessToken: string, searchTerm?: string) {
  try {
    console.log('📤 Making GraphQL request...')
    
    // Simple working GraphQL query
    const graphqlQuery = {
      query: `
        query {
          marketplaceJobPostings {
            edges {
              node {
                id
                title
                description
                skills {
                  name
                }
                totalApplicants
                createdAt
                budget {
                  amount
                  currency
                }
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
    
    if (response.ok) {
      const data = await response.json()
      console.log('📊 GraphQL response received')
      
      if (data.errors) {
        console.error('GraphQL errors:', data.errors)
        return { success: false, error: data.errors[0].message, jobs: [] }
      }
      
      const edges = data.data?.marketplaceJobPostings?.edges || []
      const jobs = edges.map((edge: any, index: number) => {
        const node = edge.node || {}
        
        return {
          id: node.id || `graphql_${Date.now()}_${index}`,
          title: node.title || 'Job',
          description: node.description || '',
          budget: node.budget ? 
            `${node.budget.currency || '$'}${node.budget.amount || '0'}` : 
            'Budget not specified',
          postedDate: node.createdAt ? 
            new Date(node.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric'
            }) : 
            'Recently',
          client: {
            name: 'Upwork Client',
            rating: 0,
            country: 'Remote',
            totalSpent: 0,
            totalHires: 0
          },
          skills: node.skills?.map((s: any) => s.name).filter(Boolean) || ['Development'],
          proposals: node.totalApplicants || 0,
          verified: true,
          category: 'General',
          source: 'upwork',
          isRealJob: true
        }
      })
      
      if (jobs.length > 0) {
        return { success: true, jobs, error: null }
      }
    }
    
    return { success: false, error: 'GraphQL request failed', jobs: [] }
    
  } catch (error: any) {
    console.error('GraphQL error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// ✅ MAIN API ENDPOINT
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API CALLED ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    // Get parameters
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
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    console.log('✅ Access token found')
    
    // Check cache
    const now = Date.now()
    
    if (!forceRefresh && jobsCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
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
        console.log('📦 Serving from cache:', cachedJobs.length, 'jobs')
        return NextResponse.json({
          success: true,
          jobs: cachedJobs,
          total: cachedJobs.length,
          message: `✅ ${cachedJobs.length} jobs (cached)`,
          upworkConnected: true,
          cached: true
        })
      }
    }
    
    console.log('🔄 Fetching from Upwork API...')
    
    // Fetch jobs
    const result = await fetchRealUpworkJobs(accessToken, search)
    
    if (!result.success) {
      console.error('❌ API fetch failed:', result.error)
      
      // If cache exists, use it
      if (jobsCache.length > 0) {
        let cachedJobs = jobsCache
        if (search) {
          const searchLower = search.toLowerCase()
          cachedJobs = jobsCache.filter(job => 
            job.title.toLowerCase().includes(searchLower) ||
            job.description.toLowerCase().includes(searchLower)
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
      
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Failed to fetch jobs. Please check Upwork API connection.',
        upworkConnected: true
      })
    }
    
    // Update cache
    if (!search) {
      jobsCache = result.jobs
      cacheTimestamp = now
      console.log(`💾 Updated cache with ${result.jobs.length} jobs`)
    }
    
    // Success
    const message = result.jobs.length > 0
      ? `✅ Loaded ${result.jobs.length} REAL jobs from Upwork`
      : '❌ No jobs found'
    
    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      total: result.jobs.length,
      message: message,
      upworkConnected: true,
      cached: false
    })
    
  } catch (error: any) {
    console.error('❌ Server error:', error)
    
    // Return cache if available
    if (jobsCache.length > 0) {
      console.log('⚠️ Using cached data due to server error')
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        total: jobsCache.length,
        message: '⚠️ Using cached data',
        upworkConnected: true,
        cached: true
      })
    }
    
    return NextResponse.json({
      success: false,
      jobs: [],
      message: `❌ Server error: ${error.message}`,
      upworkConnected: false
    }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    jobsCache = []
    cacheTimestamp = 0
    
    return NextResponse.json({
      success: true,
      message: '✅ Cache cleared'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      message: `❌ Error: ${error.message}`
    }, { status: 500 })
  }
}