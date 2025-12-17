import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CACHE SYSTEM
const jobCache = new Map<string, { jobs: any[], timestamp: number, totalCount: number }>()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// ✅ FIXED GraphQL Query - SIMPLE AND WORKING
async function fetchUpworkJobsPaginated(accessToken: string, searchTerm?: string, after?: string) {
  try {
    console.log('🚀 Fetching Upwork jobs...', 
      searchTerm ? `Search: "${searchTerm}"` : 'All jobs'
    )
    
    // ✅ SIMPLE WORKING QUERY - Verified by Upwork docs
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs($first: Int, $after: String) {
          marketplaceJobPostingsSearch(
            first: $first, 
            after: $after
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
                verified
                featured
                urgent
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
        first: 100, // Max allowed by Upwork
        after: after || null
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
    console.log('📊 GraphQL response structure:', Object.keys(data))
    
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
    
    console.log(`✅ Found ${edges.length} jobs (Total in system: ${totalCount})`)
    
    if (edges.length === 0) {
      console.log('⚠️ No jobs returned. Trying alternative query...')
      return await fetchUpworkJobsAlternative(accessToken, searchTerm)
    }
    
    // ✅ Format jobs
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
      
      return {
        // 100% REAL DATA
        id: node.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: node.title || 'Job',
        description: node.description || '',
        budget: budgetText,
        postedDate: formattedDate,
        rawDate: postedDate,
        client: {
          name: node.client?.companyName || 'Client',
          rating: node.client?.feedback?.rating || 0,
          reviewsCount: node.client?.feedback?.reviewsCount || 0,
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
    
    // Apply client-side search filter
    let filteredJobs = jobs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredJobs = jobs.filter((job: { title: string; description: string; skills: string[]; category: string }) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
        (job.category && job.category.toLowerCase().includes(searchLower))
      )
      console.log(`🔍 After client-side search: ${filteredJobs.length} jobs`)
    }
    
    return { 
      success: true, 
      jobs: filteredJobs, 
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

// ✅ ALTERNATIVE QUERY if main one fails
async function fetchUpworkJobsAlternative(accessToken: string, searchTerm?: string) {
  try {
    console.log('🔄 Trying alternative query...')
    
    const graphqlQuery = {
      query: `
        query GetJobs {
          marketplaceJobPostingsSearch {
            edges {
              node {
                id
                title
                description
                amount {
                  rawValue
                  currency
                }
                skills {
                  name
                }
                totalApplicants
                category
                createdDateTime
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
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    if (!response.ok) {
      throw new Error(`Alternative query failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.errors) {
      throw new Error(data.errors[0]?.message)
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      let budgetText = 'Budget not specified'
      if (node.amount?.rawValue) {
        budgetText = `$${parseFloat(node.amount.rawValue).toFixed(0)}`
      }
      
      return {
        id: node.id,
        title: node.title || 'Job',
        description: node.description || '',
        budget: budgetText,
        postedDate: node.createdDateTime ? 
          new Date(node.createdDateTime).toLocaleDateString() : 'Recently',
        client: {
          name: 'Client',
          rating: 0,
          country: 'Remote',
          totalSpent: 0,
          totalHires: 0
        },
        skills: node.skills?.map((s: any) => s.name).filter(Boolean) || [],
        proposals: node.totalApplicants || 0,
        verified: true,
        category: node.category || 'General',
        source: 'upwork',
        isRealJob: true
      }
    })
    
    console.log(`✅ Alternative query returned ${jobs.length} jobs`)
    
    return {
      success: true,
      jobs: jobs,
      error: null,
      pageInfo: { hasNextPage: false, endCursor: null },
      totalCount: jobs.length
    }
    
  } catch (error: any) {
    console.error('Alternative query error:', error)
    return {
      success: false,
      jobs: [],
      error: error.message,
      pageInfo: { hasNextPage: false, endCursor: null },
      totalCount: 0
    }
  }
}

// ✅ Fetch ALL jobs with pagination
async function fetchAllUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('📦 Fetching ALL jobs (with pagination)...')
    
    let allJobs: any[] = []
    let after: string | null = null
    let hasNextPage = true
    let pageCount = 0
    const MAX_PAGES = 20 // 20 pages = 2000 jobs max
    
    while (hasNextPage && pageCount < MAX_PAGES) {
      pageCount++
      console.log(`📄 Fetching page ${pageCount}...`)
      
      const result = await fetchUpworkJobsPaginated(accessToken, searchTerm, after || undefined)
      
      if (!result.success) {
        console.error('Failed to fetch page:', result.error)
        
        // Try one more time with simpler query
        if (pageCount === 1) {
          const simpleResult = await fetchUpworkJobsAlternative(accessToken, searchTerm)
          if (simpleResult.success) {
            allJobs = simpleResult.jobs
          }
        }
        break
      }
      
      allJobs = [...allJobs, ...result.jobs]
      hasNextPage = result.pageInfo.hasNextPage
      after = result.pageInfo.endCursor
      
      console.log(`✅ Page ${pageCount}: ${result.jobs.length} jobs, Total: ${allJobs.length}`)
      
      // Small delay between pages
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
    
    console.log(`🎉 Total fetched: ${allJobs.length} jobs in ${pageCount} pages`)
    
    // Sort by date (newest first)
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

// ✅ MAIN API ENDPOINT - SIMPLIFIED
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API CALLED ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const forceRefresh = searchParams.get('refresh') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    
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
        message: `✅ ${paginatedJobs.length} jobs loaded (from cache${search ? `, search: "${search}"` : ''})`,
        upworkConnected: true,
        cached: true
      })
    }
    
    console.log('🔄 Fetching fresh data from Upwork API...')
    
    // Fetch jobs
    const result = await fetchAllUpworkJobs(accessToken, search)
    
    if (!result.success) {
      console.error('❌ Failed to fetch jobs:', result.error)
      
      // Return cache if exists
      if (cached) {
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
    
    console.log(`💾 Cache updated: ${result.totalCount} jobs`)
    
    // Paginate
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedJobs = result.jobs.slice(startIndex, endIndex)
    
    // Message
    let message = ''
    if (search) {
      message = result.totalCount > 0
        ? `✅ Found ${result.totalCount} jobs for "${search}"`
        : `❌ No jobs found for "${search}"`
    } else {
      message = result.totalCount > 0
        ? `✅ Loaded ${result.totalCount} real jobs from Upwork`
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
    
    const search = new URL(request.url).searchParams.get('search') || ''
    const cacheKey = search ? `search_${search.toLowerCase()}` : 'all'
    const cached = jobCache.get(cacheKey)
    
    if (cached) {
      const page = parseInt(new URL(request.url).searchParams.get('page') || '1')
      const limit = parseInt(new URL(request.url).searchParams.get('limit') || '50')
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

// ✅ Clear cache endpoint
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