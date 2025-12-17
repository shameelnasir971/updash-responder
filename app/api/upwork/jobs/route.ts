import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ SIMPLE CACHE SYSTEM
let jobsCache: any[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// ✅ Get current date and date from one month ago
function getDateRange() {
  const now = new Date()
  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
  
  return {
    now: now.toISOString(),
    oneMonthAgo: oneMonthAgo.toISOString()
  }
}

// ✅ ADVANCED GraphQL Query with PAGINATION and FILTERS
async function fetchUpworkJobsWithPagination(
  accessToken: string, 
  searchTerm?: string,
  afterCursor?: string
) {
  try {
    console.log('🚀 Fetching jobs with pagination...', { 
      searchTerm, 
      afterCursor: afterCursor || 'first page' 
    })
    
    const { oneMonthAgo, now } = getDateRange()
    
    // ✅ COMPLETE GraphQL Query with ALL FILTERS
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs(
          $first: Int, 
          $after: String, 
          $where: JobPostingSearchCriteria,
          $orderBy: JobPostingSearchOrder
        ) {
          marketplaceJobPostingsSearch(
            first: $first,
            after: $after,
            where: $where,
            orderBy: $orderBy
          ) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
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
                durationLabel
                client {
                  displayName
                  rating
                  location {
                    country
                  }
                  totalSpent
                  totalHires
                }
                freelancerLocationRestriction {
                  countries
                }
                budget {
                  amount
                  currency
                  type
                }
                status
                visibility
                source
              }
              cursor
            }
          }
        }
      `,
      variables: {
        first: 100, // ✅ 100 JOBS PER REQUEST (MAX ALLOWED)
        after: afterCursor || null,
        where: {
          // ✅ TIME FILTER: Last month ki jobs
          createdDateTime: {
            gte: oneMonthAgo,
            lte: now
          },
          // ✅ STATUS FILTER: Only active jobs
          status: "ACTIVE",
          // ✅ SEARCH FILTER: If search term provided
          ...(searchTerm ? {
            OR: [
              { title: { contains: searchTerm } },
              { description: { contains: searchTerm } },
              { skills: { name: { contains: searchTerm } } }
            ]
          } : {})
        },
        orderBy: {
          field: "CREATED_DATE_TIME",
          direction: "DESC" // ✅ NEWEST JOBS FIRST
        }
      }
    }
    
    console.log('📤 Making GraphQL request with variables:', {
      first: graphqlQuery.variables.first,
      searchTerm: searchTerm || 'all jobs',
      timeRange: `${new Date(oneMonthAgo).toLocaleDateString()} - ${new Date(now).toLocaleDateString()}`
    })
    
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
      console.error('❌ API request failed:', errorText.substring(0, 300))
      return { 
        success: false, 
        error: `API error: ${response.status}`, 
        jobs: [],
        hasNextPage: false,
        endCursor: null,
        totalCount: 0
      }
    }
    
    const data = await response.json()
    
    // Debug log
    console.log('📊 API Response structure:', {
      hasData: !!data.data,
      hasErrors: !!data.errors,
      totalCount: data.data?.marketplaceJobPostingsSearch?.totalCount || 0,
      edgesCount: data.data?.marketplaceJobPostingsSearch?.edges?.length || 0
    })
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { 
        success: false, 
        error: data.errors[0]?.message, 
        jobs: [],
        hasNextPage: false,
        endCursor: null,
        totalCount: 0
      }
    }
    
    const searchData = data.data?.marketplaceJobPostingsSearch
    const edges = searchData?.edges || []
    const pageInfo = searchData?.pageInfo || { hasNextPage: false, endCursor: null }
    const totalCount = searchData?.totalCount || 0
    
    console.log(`✅ Found ${edges.length} jobs on this page, Total: ${totalCount}`)
    console.log(`📄 Has next page: ${pageInfo.hasNextPage}, End cursor: ${pageInfo.endCursor}`)
    
    if (edges.length === 0) {
      return { 
        success: true, 
        jobs: [], 
        error: null,
        hasNextPage: false,
        endCursor: null,
        totalCount: 0
      }
    }
    
    // ✅ Format jobs with REAL data
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // ✅ REAL BUDGET
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
      } else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
        const minVal = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : 0
        const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal
        const currency = node.hourlyBudgetMin?.currency || node.hourlyBudgetMax?.currency || 'USD'
        
        let currencySymbol = ''
        if (currency === 'USD') currencySymbol = '$'
        else if (currency === 'EUR') currencySymbol = '€'
        else if (currency === 'GBP') currencySymbol = '£'
        else currencySymbol = currency + ' '
        
        if (minVal === maxVal || maxVal === 0) {
          budgetText = `${currencySymbol}${minVal.toFixed(2)}/hr`
        } else {
          budgetText = `${currencySymbol}${minVal.toFixed(2)}-${maxVal.toFixed(2)}/hr`
        }
      }
      
      // ✅ REAL SKILLS
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // ✅ REAL DATE
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently'
      
      // ✅ REAL CATEGORY
      const category = node.category || 'General'
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      // ✅ REAL CLIENT INFO (if available)
      const clientInfo = node.client || {}
      
      return {
        // ✅ 100% REAL DATA
        id: node.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: node.title || 'Job Title',
        description: node.description || 'Job Description',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: clientInfo.displayName || 'Client',
          rating: clientInfo.rating || 0,
          country: clientInfo.location?.country || 'Remote',
          totalSpent: clientInfo.totalSpent || 0,
          totalHires: clientInfo.totalHires || 0
        },
        skills: realSkills,
        proposals: node.totalApplicants || 0,
        verified: node.status === 'ACTIVE',
        category: cleanedCategory,
        jobType: node.engagement || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        rawData: {
          createdDateTime: node.createdDateTime,
          publishedDateTime: node.publishedDateTime,
          status: node.status
        }
      }
    })
    
    return { 
      success: true, 
      jobs, 
      error: null,
      hasNextPage: pageInfo.hasNextPage,
      endCursor: pageInfo.endCursor,
      totalCount
    }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { 
      success: false, 
      error: error.message, 
      jobs: [],
      hasNextPage: false,
      endCursor: null,
      totalCount: 0
    }
  }
}

// ✅ FETCH ALL JOBS WITH MULTIPLE PAGES
async function fetchAllJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('📡 FETCHING ALL JOBS STARTED...')
    let allJobs: any[] = []
    let hasNextPage = true
    let endCursor: string | null = null
    let pageCount = 0
    const MAX_PAGES = 10 // Safety limit: 10 pages × 100 jobs = 1000 jobs
    
    while (hasNextPage && pageCount < MAX_PAGES) {
      pageCount++
      console.log(`📄 Fetching page ${pageCount}...`)
      
      const result = await fetchUpworkJobsWithPagination(
        accessToken, 
        searchTerm, 
        endCursor || undefined
      )
      
      if (!result.success) {
        console.error(`❌ Failed to fetch page ${pageCount}:`, result.error)
        break
      }
      
      // Add jobs from this page
      allJobs = [...allJobs, ...result.jobs]
      
      // Update pagination info
      hasNextPage = result.hasNextPage
      endCursor = result.endCursor
      
      console.log(`✅ Page ${pageCount}: Got ${result.jobs.length} jobs, Total so far: ${allJobs.length}`)
      
      // If we have a search term, we might not need all pages
      if (searchTerm && allJobs.length >= 50) {
        console.log(`🔍 Search "${searchTerm}" found ${allJobs.length} jobs, stopping early`)
        break
      }
      
      // Small delay to avoid rate limiting
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    console.log(`🎉 FETCH COMPLETE: ${allJobs.length} total jobs from ${pageCount} pages`)
    
    // Remove duplicates by job ID
    const uniqueJobs = Array.from(new Map(allJobs.map(job => [job.id, job])).values())
    
    return {
      success: true,
      jobs: uniqueJobs,
      totalCount: uniqueJobs.length,
      pagesFetched: pageCount
    }
    
  } catch (error: any) {
    console.error('❌ Error in fetchAllJobs:', error)
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
    console.log('=== JOBS API CALLED ===')
    
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
    
    // Check cache for non-search requests
    const now = Date.now()
    const cacheKey = search ? `search_${search}` : 'all'
    
    if (!forceRefresh && !search && jobsCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📦 Serving from cache...', jobsCache.length, 'jobs')
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        total: jobsCache.length,
        message: `✅ Loaded ${jobsCache.length} jobs (from cache, last month)`,
        upworkConnected: true,
        cached: true
      })
    }
    
    console.log('🔄 Fetching fresh data from Upwork API...')
    
    // Fetch jobs from Upwork with pagination
    const result = await fetchAllJobs(accessToken, search)
    
    if (!result.success) {
      console.error('❌ Failed to fetch jobs:', result.error)
      
      // If cache exists for non-search, return cache
      if (!search && jobsCache.length > 0) {
        console.log('⚠️ Using cached data due to API error')
        return NextResponse.json({
          success: true,
          jobs: jobsCache,
          total: jobsCache.length,
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
    
    // Update cache (only if no search)
    if (!search) {
      jobsCache = result.jobs
      cacheTimestamp = now
      console.log(`💾 Updated cache with ${result.jobs.length} jobs`)
    }
    
    // Prepare message
    let message = ''
    if (search) {
      message = result.jobs.length > 0
        ? `✅ Found ${result.jobs.length} jobs for "${search}" (last month)`
        : `❌ No jobs found for "${search}" in last month`
    } else {
      message = result.jobs.length > 0
        ? `✅ Loaded ${result.jobs.length} real jobs from Upwork (last month)`
        : '❌ No jobs found in last month'
    }
    
    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      total: result.jobs.length,
      message: message,
      upworkConnected: true,
      cached: false,
      meta: {
        pagesFetched: result.pagesFetched || 1,
        timeRange: 'Last month',
        source: 'upwork_api'
      }
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    
    // Return cache if available and no search
    if (jobsCache.length > 0) {
      console.log('⚠️ Returning cached data due to error')
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        total: jobsCache.length,
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