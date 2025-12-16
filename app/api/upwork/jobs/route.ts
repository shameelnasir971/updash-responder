// app/api/upwork/jobs/route.ts - SIMPLIFIED WORKING VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Cache system
let jobsCache: any = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000

// ✅ SIMPLE WORKING GRAPHQL QUERY
async function fetchUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching jobs with SIMPLE query...')
    
    // ✅ BASIC WORKING QUERY - NO COMPLEX PARAMS
    const graphqlQuery = {
      query: `
        {
          marketplaceJobPostingsSearch(
            first: 50
            sortBy: { field: CREATED_TIME, direction: DESC }
          ) {
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
                totalApplicants
                category
                createdDateTime
                publishedDateTime
                experienceLevel
                engagement
                duration
              }
            }
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `
    }
    
    console.log('📤 Making simple GraphQL request...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API error:', errorText.substring(0, 300))
      return { 
        success: false, 
        error: `API error ${response.status}`, 
        jobs: []
      }
    }
    
    const data = await response.json()
    
    // Log response for debugging
    console.log('📊 API Response structure:', {
      hasData: !!data.data,
      hasErrors: !!data.errors,
      edgesCount: data.data?.marketplaceJobPostingsSearch?.edges?.length || 0
    })
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { 
        success: false, 
        error: data.errors[0]?.message, 
        jobs: [] 
      }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    const totalCount = data.data?.marketplaceJobPostingsSearch?.totalCount || 0
    const hasNextPage = data.data?.marketplaceJobPostingsSearch?.pageInfo?.hasNextPage || false
    
    console.log(`✅ Found ${edges.length} jobs (Total: ${totalCount})`)
    
    if (edges.length === 0) {
      return { 
        success: true, 
        jobs: [], 
        error: null,
        totalCount: 0,
        hasNextPage: false
      }
    }
    
    // ✅ Format jobs
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // Budget
      let budgetText = 'Budget not specified'
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        
        if (currency === 'USD') {
          budgetText = `$${rawValue.toFixed(2)}`
        } else if (currency === 'EUR') {
          budgetText = `€${rawValue.toFixed(2)}`
        } else if (currency === 'GBP') {
          budgetText = `£${rawValue.toFixed(2)}`
        } else {
          budgetText = `${rawValue.toFixed(2)} ${currency}`
        }
      }
      
      // Skills
      const skills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // Date
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }) : 
        'Recently'
      
      // Category
      const category = node.category || 'General'
      const cleanedCategory = category
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      return {
        id: node.id || `job_${Date.now()}`,
        title: node.title || 'Job',
        description: node.description || '',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: 'Client', // Generic - Upwork doesn't expose client names
          rating: 0,
          country: 'Remote',
          totalSpent: 0,
          totalHires: 0
        },
        skills: skills.slice(0, 5),
        proposals: node.totalApplicants || 0,
        verified: true,
        category: cleanedCategory,
        jobType: node.engagement || node.duration || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} jobs successfully`)
    
    return { 
      success: true, 
      jobs: jobs, 
      error: null,
      totalCount: totalCount,
      hasNextPage: hasNextPage
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

// ✅ SEARCH FUNCTION (Client-side filtering)
async function searchJobs(jobs: any[], searchTerm: string) {
  if (!searchTerm.trim()) return jobs
  
  const searchLower = searchTerm.toLowerCase()
  
  return jobs.filter(job => 
    job.title.toLowerCase().includes(searchLower) ||
    job.description.toLowerCase().includes(searchLower) ||
    job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
    job.category.toLowerCase().includes(searchLower)
  )
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API CALLED ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Get parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const forceRefresh = searchParams.get('refresh') === 'true'
    
    console.log('📋 Parameters:', { search, page, forceRefresh })
    
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
    
    // Check cache
    const now = Date.now()
    const cacheKey = search ? `search:${search}` : 'all'
    
    if (!forceRefresh && page === 1 && jobsCache && 
        jobsCache[cacheKey] && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📦 Serving from cache...')
      const cachedJobs = search ? 
        await searchJobs(jobsCache[cacheKey], search) : 
        jobsCache[cacheKey]
      
      return NextResponse.json({
        success: true,
        jobs: cachedJobs.slice(0, 50),
        total: cachedJobs.length,
        message: `✅ ${cachedJobs.length} jobs (from cache)`,
        upworkConnected: true,
        cached: true
      })
    }
    
    console.log('🔄 Fetching fresh data...')
    
    // Fetch from Upwork
    const result = await fetchUpworkJobs(accessToken)
    
    if (!result.success) {
      console.error('❌ Fetch failed:', result.error)
      
      // Try cache if available
      if (jobsCache && jobsCache[cacheKey]) {
        console.log('⚠️ Using cached data due to API error')
        const cachedJobs = search ? 
          await searchJobs(jobsCache[cacheKey], search) : 
          jobsCache[cacheKey]
        
        return NextResponse.json({
          success: true,
          jobs: cachedJobs.slice(0, 50),
          total: cachedJobs.length,
          message: `⚠️ Using cached data (API error)`,
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
    if (page === 1) {
      if (!jobsCache) jobsCache = {}
      jobsCache['all'] = result.jobs
      cacheTimestamp = now
      console.log(`💾 Cached ${result.jobs.length} jobs`)
    }
    
    // Apply search filter
    let filteredJobs = result.jobs
    if (search) {
      filteredJobs = await searchJobs(result.jobs, search)
    }
    
    // Apply pagination
    const startIndex = (page - 1) * 50
    const endIndex = startIndex + 50
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex)
    
    // Prepare message
    const totalFiltered = filteredJobs.length
    const totalPages = Math.ceil(totalFiltered / 50)
    
    let message = ''
    if (search) {
      message = totalFiltered > 0 
        ? `✅ Found ${totalFiltered} jobs for "${search}"`
        : `❌ No jobs found for "${search}"`
    } else {
      message = totalFiltered > 0 
        ? `✅ Loaded ${paginatedJobs.length} jobs (${totalFiltered} total, page ${page}/${totalPages})`
        : '❌ No jobs found'
    }
    
    return NextResponse.json({
      success: true,
      jobs: paginatedJobs,
      total: totalFiltered,
      message: message,
      upworkConnected: true,
      cached: false,
      page: page,
      totalPages: totalPages,
      hasNextPage: page < totalPages
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    
    // Return empty array on error
    return NextResponse.json({
      success: false,
      jobs: [],
      message: `❌ Server error: ${error.message}`,
      upworkConnected: false
    }, { status: 500 })
  }
}

// Clear cache
export async function POST(request: NextRequest) {
  try {
    jobsCache = null
    cacheTimestamp = 0
    
    return NextResponse.json({
      success: true,
      message: '✅ Cache cleared'
    })
  } catch (error: any) {
    console.error('POST error:', error)
    return NextResponse.json({
      success: false,
      message: `❌ Error: ${error.message}`
    }, { status: 500 })
  }
}