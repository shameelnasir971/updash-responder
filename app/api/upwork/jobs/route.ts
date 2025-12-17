import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CACHE SYSTEM for better performance
const jobCache = new Map<string, { jobs: any[], timestamp: number, totalCount: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// ✅ COMPLETE GraphQL Query using ALL permissions
async function fetchUpworkJobsPaginated(accessToken: string, searchTerm?: string, after?: string) {
  try {
    console.log('🚀 Fetching Upwork jobs with pagination...', 
      searchTerm ? `Search: "${searchTerm}"` : 'All jobs',
      after ? `After cursor: ${after.substring(0, 20)}...` : 'First page'
    )
    
    // ✅ Build filter based on search
    const filter: any = {}
    
    // If search term provided, search in title and description
    if (searchTerm && searchTerm.trim()) {
      filter.and = [
        {
          or: [
            { field: "TITLE", operator: "CONTAINS", value: searchTerm },
            { field: "DESCRIPTION", operator: "CONTAINS", value: searchTerm },
            { field: "CATEGORY", operator: "CONTAINS", value: searchTerm }
          ]
        }
      ]
    }
    
    // ✅ COMPLETE GraphQL Query using all permissions
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs($first: Int, $after: String, $filter: MarketplaceJobPostingsSearchFilter) {
          marketplaceJobPostingsSearch(
            first: $first, 
            after: $after, 
            filter: $filter
          ) {
            totalCount
            edges {
              cursor
              node {
                id
                title
                description
                category
                subcategory
                createdDateTime
                publishedDateTime
                updatedDateTime
                
                amount {
                  rawValue
                  currency
                  displayValue
                }
                hourlyBudgetMin {
                  rawValue
                  currency
                  displayValue
                }
                hourlyBudgetMax {
                  rawValue
                  currency
                  displayValue
                }
                
                client {
                  id
                  companyName
                  location {
                    city
                    country
                  }
                  feedback {
                    score
                    rating
                    reviewsCount
                  }
                  totalSpent
                  totalHires
                }
                
                skills {
                  name
                  experienceLevel
                }
                totalApplicants
                proposalsCount
                interviewCount
                hiresCount
                
                engagement
                duration
                durationLabel
                experienceLevel
                
                timezones
                languages {
                  name
                  level
                }
                contracts {
                  type
                  status
                }
                
                verified
                featured
                urgent
                private
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      variables: {
        first: 100, // ✅ 100 jobs per page (Upwork max)
        after: after || null,
        filter: Object.keys(filter).length > 0 ? filter : null
      }
    }
    
    console.log('📤 Making GraphQL request...')
    
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
      console.error('❌ API request failed:', errorText.substring(0, 500))
      return { 
        success: false, 
        error: `API error: ${response.status}`, 
        jobs: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        totalCount: 0
      }
    }
    
    const data = await response.json()
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { 
        success: false, 
        error: data.errors[0]?.message, 
        jobs: [],
        pageInfo: { hasNextPage: false, endCursor: null },
        totalCount: 0
      }
    }
    
    const searchData = data.data?.marketplaceJobPostingsSearch
    const edges = searchData?.edges || []
    const pageInfo = searchData?.pageInfo || { hasNextPage: false, endCursor: null }
    const totalCount = searchData?.totalCount || 0
    
    console.log(`✅ Found ${edges.length} jobs (Total: ${totalCount})`, 
      pageInfo.hasNextPage ? `Has next page: ${pageInfo.endCursor?.substring(0, 20)}...` : 'No more pages'
    )
    
    // ✅ Format jobs with REAL data
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // Format budget
      let budgetText = 'Budget not specified'
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        budgetText = `${currency === 'USD' ? '$' : currency}${rawValue.toFixed(0)}`
      } else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
        const minVal = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : 0
        const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal
        const currency = node.hourlyBudgetMin?.currency || node.hourlyBudgetMax?.currency || 'USD'
        
        if (minVal === maxVal || maxVal === 0) {
          budgetText = `${currency === 'USD' ? '$' : currency}${minVal.toFixed(0)}/hr`
        } else {
          budgetText = `${currency === 'USD' ? '$' : currency}${minVal.toFixed(0)}-${maxVal.toFixed(0)}/hr`
        }
      }
      
      // Format date
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 'Recently'
      
      // Format client rating
      const clientRating = node.client?.feedback?.rating || 0
      const clientReviews = node.client?.feedback?.reviewsCount || 0
      
      return {
        // 100% REAL DATA
        id: node.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: node.title || 'Job',
        description: node.description || '',
        budget: budgetText,
        postedDate: formattedDate,
        rawDate: postedDate,
        client: {
          id: node.client?.id,
          name: node.client?.companyName || 'Client',
          rating: clientRating,
          reviewsCount: clientReviews,
          country: node.client?.location?.country || 'Remote',
          totalSpent: node.client?.totalSpent || 0,
          totalHires: node.client?.totalHires || 0
        },
        skills: node.skills?.map((s: any) => s.name).filter(Boolean) || [],
        proposals: node.proposalsCount || node.totalApplicants || 0,
        hiresCount: node.hiresCount || 0,
        interviewCount: node.interviewCount || 0,
        verified: node.verified || false,
        featured: node.featured || false,
        urgent: node.urgent || false,
        private: node.private || false,
        category: node.category || 'General',
        subcategory: node.subcategory || '',
        engagement: node.engagement || '',
        duration: node.duration || '',
        experienceLevel: node.experienceLevel || '',
        timezones: node.timezones || [],
        source: 'upwork',
        isRealJob: true,
        cursor: edge.cursor
      }
    })
    
    return { 
      success: true, 
      jobs: jobs, 
      error: null,
      pageInfo: pageInfo,
      totalCount: totalCount
    }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { 
      success: false, 
      error: error.message, 
      jobs: [],
      pageInfo: { hasNextPage: false, endCursor: null },
      totalCount: 0
    }
  }
}

// ✅ Fetch ALL jobs with pagination
async function fetchAllUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('📦 Fetching ALL jobs...')
    
    let allJobs: any[] = []
    let after: string | null = null
    let hasNextPage = true
    let pageCount = 0
    const MAX_PAGES = 50 // ✅ Maximum 50 pages = 5000 jobs
    
    while (hasNextPage && pageCount < MAX_PAGES) {
      console.log(`📄 Fetching page ${pageCount + 1}...`)
      
      const result = await fetchUpworkJobsPaginated(accessToken, searchTerm, after || undefined)
      
      if (!result.success) {
        console.error('Failed to fetch page:', result.error)
        break
      }
      
      allJobs = [...allJobs, ...result.jobs]
      hasNextPage = result.pageInfo.hasNextPage
      after = result.pageInfo.endCursor
      pageCount++
      
      console.log(`✅ Page ${pageCount}: ${result.jobs.length} jobs, Total: ${allJobs.length}`)
      
      // Small delay to avoid rate limiting
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    console.log(`🎉 Fetched ${allJobs.length} total jobs in ${pageCount} pages`)
    
    // ✅ Sort by date (newest first)
    allJobs.sort((a, b) => {
      const dateA = a.rawDate ? new Date(a.rawDate).getTime() : 0
      const dateB = b.rawDate ? new Date(b.rawDate).getTime() : 0
      return dateB - dateA
    })
    
    return {
      success: true,
      jobs: allJobs,
      totalCount: allJobs.length,
      pagesFetched: pageCount
    }
    
  } catch (error: any) {
    console.error('❌ Fetch all jobs error:', error)
    return {
      success: false,
      jobs: [],
      totalCount: 0,
      error: error.message
    }
  }
}

// ✅ MAIN API ENDPOINT
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API: COMPLETE VERSION ===')
    
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
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '100')
    
    console.log('Parameters:', { search, forceRefresh, page, limit })
    
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
    const cacheKey = search ? `search_${search.toLowerCase()}` : 'all'
    const cached = jobCache.get(cacheKey)
    const now = Date.now()
    
    if (!forceRefresh && cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log('📦 Serving from cache...', cached.totalCount, 'jobs')
      
      // Paginate cached results
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedJobs = cached.jobs.slice(startIndex, endIndex)
      
      return NextResponse.json({
        success: true,
        jobs: paginatedJobs,
        total: cached.totalCount,
        page: page,
        limit: limit,
        totalPages: Math.ceil(cached.totalCount / limit),
        message: `✅ ${cached.totalCount} jobs loaded (from cache${search ? `, search: "${search}"` : ''})`,
        upworkConnected: true,
        cached: true
      })
    }
    
    console.log('🔄 Fetching fresh data from Upwork API...')
    
    // Fetch all jobs from Upwork
    const result = await fetchAllUpworkJobs(accessToken, search)
    
    if (!result.success) {
      console.error('❌ Failed to fetch jobs:', result.error)
      
      // If cache exists, return cache even with error
      if (cached) {
        console.log('⚠️ Using cached data due to API error')
        
        const startIndex = (page - 1) * limit
        const endIndex = startIndex + limit
        const paginatedJobs = cached.jobs.slice(startIndex, endIndex)
        
        return NextResponse.json({
          success: true,
          jobs: paginatedJobs,
          total: cached.totalCount,
          page: page,
          limit: limit,
          totalPages: Math.ceil(cached.totalCount / limit),
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
    jobCache.set(cacheKey, {
      jobs: result.jobs,
      timestamp: now,
      totalCount: result.totalCount
    })
    
    console.log(`💾 Updated cache with ${result.totalCount} jobs`)
    
    // Paginate results
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedJobs = result.jobs.slice(startIndex, endIndex)
    
    // Prepare message
    let message = ''
    if (search) {
      message = result.totalCount > 0
        ? `✅ Found ${result.totalCount} jobs for "${search}"`
        : `❌ No jobs found for "${search}"`
    } else {
      message = result.totalCount > 0
        ? `✅ Loaded ${result.totalCount} real jobs from Upwork (${result.pagesFetched || 1} pages)`
        : '❌ No jobs found'
    }
    
    return NextResponse.json({
      success: true,
      jobs: paginatedJobs,
      total: result.totalCount,
      page: page,
      limit: limit,
      totalPages: Math.ceil(result.totalCount / limit),
      message: message,
      upworkConnected: true,
      cached: false,
      pagesFetched: result.pagesFetched || 1
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    
    // Return cache if available
    const cacheKey = new URL(request.url).searchParams.get('search') 
      ? `search_${new URL(request.url).searchParams.get('search')?.toLowerCase()}` 
      : 'all'
    
    const cached = jobCache.get(cacheKey)
    if (cached) {
      console.log('⚠️ Returning cached data due to error')
      
      const page = parseInt(new URL(request.url).searchParams.get('page') || '1')
      const limit = parseInt(new URL(request.url).searchParams.get('limit') || '100')
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedJobs = cached.jobs.slice(startIndex, endIndex)
      
      return NextResponse.json({
        success: true,
        jobs: paginatedJobs,
        total: cached.totalCount,
        page: page,
        limit: limit,
        totalPages: Math.ceil(cached.totalCount / limit),
        message: `⚠️ Using cached data (Error: ${error.message})`,
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

// ✅ CLEAR CACHE ENDPOINT
export async function POST(request: NextRequest) {
  try {
    const { cacheKey } = await request.json()
    
    if (cacheKey) {
      jobCache.delete(cacheKey)
      return NextResponse.json({
        success: true,
        message: `✅ Cache cleared for key: ${cacheKey}`
      })
    } else {
      jobCache.clear()
      return NextResponse.json({
        success: true,
        message: '✅ All cache cleared successfully'
      })
    }
    
  } catch (error: any) {
    console.error('POST error:', error)
    return NextResponse.json({
      success: false,
      message: `❌ Error: ${error.message}`
    }, { status: 500 })
  }
}

// ✅ BACKGROUND JOB FETCHER (Auto-refresh every 5 minutes)
async function backgroundJobFetcher() {
  try {
    console.log('🔄 Background job fetcher running...')
    
    const upworkResult = await pool.query(
      'SELECT user_id, access_token FROM upwork_accounts LIMIT 1'
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('No Upwork connection for background fetch')
      return
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Fetch all jobs without search
    const result = await fetchAllUpworkJobs(accessToken)
    
    if (result.success) {
      // Update cache
      jobCache.set('all', {
        jobs: result.jobs,
        timestamp: Date.now(),
        totalCount: result.totalCount
      })
      
      console.log(`✅ Background fetch completed: ${result.totalCount} jobs`)
    } else {
      console.error('Background fetch failed:', result.error)
    }
  } catch (error) {
    console.error('Background fetcher error:', error)
  }
}

// ✅ Run background fetcher every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(backgroundJobFetcher, 5 * 60 * 1000) // 5 minutes
  
  // Run once on startup
  setTimeout(backgroundJobFetcher, 10000) // 10 seconds after startup
}