import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Cache system
let jobsCache: any[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache

// Helper function to build GraphQL query with filters
function buildGraphQLQuery(searchTerm?: string, page = 0) {
  // ✅ Calculate date for last 30 days
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const isoDate = thirtyDaysAgo.toISOString()

  // ✅ Build filter object
  let filter = {}
  
  if (searchTerm) {
    // Search by title, description, or skills
    filter = {
      or: [
        { title: { contains: searchTerm } },
        { description: { contains: searchTerm } },
        { skills: { some: { name: { contains: searchTerm } } } }
      ]
    }
  }

  // Always filter by date (last 30 days)
  filter = {
    ...filter,
    createdDateTime: { gte: isoDate }
  }

  return {
    query: `
      query GetMarketplaceJobs($first: Int, $after: String, $filter: MarketplaceJobPostingsSearchFilterInput) {
        marketplaceJobPostingsSearch(
          first: $first
          after: $after
          filter: $filter
          sort: { field: CREATED_DATE_TIME, direction: DESC }
        ) {
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
                id
                displayName
                feedbackScore
                location {
                  country
                }
                totalSpent
                totalHires
              }
            }
          }
        }
      }
    `,
    variables: {
      first: 1000, // ✅ Maximum allowed by Upwork
      after: page > 0 ? `cursor_${page}` : null,
      filter: filter
    }
  }
}

// Fetch jobs from Upwork with pagination
async function fetchAllUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 Fetching ALL Upwork jobs...', searchTerm ? `Search: "${searchTerm}"` : 'All jobs')
    
    const allJobs: any[] = []
    let hasNextPage = true
    let page = 0
    const maxPages = 10 // Safety limit
    
    while (hasNextPage && page < maxPages) {
      console.log(`📄 Fetching page ${page + 1}...`)
      
      const graphqlQuery = buildGraphQLQuery(searchTerm, page)
      
      const response = await fetch('https://api.upwork.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(graphqlQuery)
      })
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`❌ API error on page ${page}:`, response.status, errorText.substring(0, 200))
        break
      }
      
      const data = await response.json()
      
      if (data.errors) {
        console.error(`❌ GraphQL errors on page ${page}:`, data.errors)
        break
      }
      
      const searchResult = data.data?.marketplaceJobPostingsSearch
      const edges = searchResult?.edges || []
      
      console.log(`✅ Page ${page + 1}: ${edges.length} jobs`)
      
      // Format jobs
      const formattedJobs = edges.map((edge: any) => {
        const node = edge.node || {}
        
        // Budget
        let budgetText = 'Budget not specified'
        if (node.amount?.rawValue) {
          const rawValue = parseFloat(node.amount.rawValue)
          const currency = node.amount.currency || 'USD'
          budgetText = `${currency === 'USD' ? '$' : currency}${rawValue.toFixed(2)}`
        } else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
          const minVal = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : 0
          const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal
          const currency = node.hourlyBudgetMin?.currency || node.hourlyBudgetMax?.currency || 'USD'
          const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency
          
          if (minVal === maxVal) {
            budgetText = `${symbol}${minVal.toFixed(2)}/hr`
          } else {
            budgetText = `${symbol}${minVal.toFixed(2)}-${maxVal.toFixed(2)}/hr`
          }
        }
        
        // Date
        const postedDate = node.createdDateTime || node.publishedDateTime
        const formattedDate = postedDate ? 
          new Date(postedDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 
          'Recently'
        
        // Client info (REAL from API)
        const client = node.client || {}
        
        return {
          id: node.id || `job_${Date.now()}_${Math.random()}`,
          title: node.title || 'Job Title',
          description: node.description || '',
          budget: budgetText,
          postedDate: formattedDate,
          client: {
            name: client.displayName || 'Client',
            rating: client.feedbackScore || 0,
            country: client.location?.country || 'Remote',
            totalSpent: client.totalSpent || 0,
            totalHires: client.totalHires || 0
          },
          skills: node.skills?.map((s: any) => s.name).filter(Boolean) || [],
          proposals: node.totalApplicants || 0,
          verified: true,
          category: node.category || 'General',
          jobType: node.engagement || node.durationLabel || 'Not specified',
          experienceLevel: node.experienceLevel || 'Not specified',
          source: 'upwork',
          isRealJob: true,
          createdAt: postedDate
        }
      })
      
      allJobs.push(...formattedJobs)
      
      // Check if there are more pages
      hasNextPage = searchResult?.pageInfo?.hasNextPage || false
      page++
      
      // If we have enough jobs, break
      if (allJobs.length >= 100) {
        console.log(`✅ Reached ${allJobs.length} jobs, stopping pagination`)
        break
      }
      
      // Wait a bit between requests to avoid rate limiting
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
    
    console.log(`🎉 Total jobs fetched: ${allJobs.length}`)
    
    // Sort by date (newest first)
    allJobs.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime()
      const dateB = new Date(b.createdAt || 0).getTime()
      return dateB - dateA
    })
    
    return { 
      success: true, 
      jobs: allJobs, 
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

// Main API endpoint
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
    
    // Check cache (skip if search or force refresh)
    const now = Date.now()
    const cacheKey = search ? `search_${search}` : 'all'
    
    if (!forceRefresh && !search && jobsCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📦 Serving from cache...', jobsCache.length, 'jobs')
      return NextResponse.json({
        success: true,
        jobs: jobsCache.slice(0, 200), // Limit to 200 for performance
        total: jobsCache.length,
        message: `✅ ${jobsCache.length} jobs loaded (from cache)`,
        upworkConnected: true,
        cached: true
      })
    }
    
    console.log('🔄 Fetching fresh data from Upwork API...')
    
    // Fetch jobs from Upwork
    const result = await fetchAllUpworkJobs(accessToken, search)
    
    if (!result.success) {
      console.error('❌ Failed to fetch jobs:', result.error)
      
      // If cache exists, return cache even with error
      if (!search && jobsCache.length > 0) {
        console.log('⚠️ Using cached data due to API error')
        return NextResponse.json({
          success: true,
          jobs: jobsCache.slice(0, 200),
          total: jobsCache.length,
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
    
    // Update cache (only if no search)
    if (!search) {
      jobsCache = result.jobs
      cacheTimestamp = now
      console.log(`💾 Updated cache with ${result.jobs.length} jobs`)
    }
    
    // Prepare response
    const jobsToReturn = search ? result.jobs : result.jobs.slice(0, 200) // Limit non-search results
    
    const message = search
      ? result.jobs.length > 0
        ? `✅ Found ${result.jobs.length} jobs for "${search}"`
        : `❌ No jobs found for "${search}"`
      : `✅ Loaded ${result.jobs.length} real jobs from Upwork (last 30 days)`
    
    return NextResponse.json({
      success: true,
      jobs: jobsToReturn,
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
        jobs: jobsCache.slice(0, 200),
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

// Clear cache endpoint
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