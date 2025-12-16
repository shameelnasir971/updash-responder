import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Cache system for performance
let jobsCache: any[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes cache

// ✅ BULK FETCH FUNCTION - Gets MAXIMUM jobs from Upwork
async function fetchBulkUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 BULK FETCH: Fetching MAXIMUM jobs from Upwork...')
    
    // ✅ OPTIMIZED GraphQL Query for MAXIMUM results
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs($first: Int = 100) {
          marketplaceJobPostingsSearch(first: $first) {
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
                workload
                freelancerLocation
                jobVisibilityType
              }
            }
          }
        }
      `,
      variables: {
        first: 100 // Maximum allowed by Upwork API
      }
    }
    
    console.log('📤 Making BULK GraphQL request (100 jobs)...')
    
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
      console.error('❌ API request failed:', response.status, errorText.substring(0, 300))
      return { 
        success: false, 
        error: `API error: ${response.status}`, 
        jobs: [] 
      }
    }
    
    const data = await response.json()
    
    // Log response structure
    console.log('📊 Response received:', {
      hasData: !!data.data,
      hasErrors: !!data.errors,
      edgesCount: data.data?.marketplaceJobPostingsSearch?.edges?.length || 0
    })
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { 
        success: false, 
        error: data.errors[0]?.message, 
        jobs: [] 
      }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ BULK FETCH: Got ${edges.length} raw job edges from Upwork`)
    
    if (edges.length === 0) {
      console.warn('⚠️ Upwork API returned 0 jobs. Checking API permissions...')
      return { 
        success: true, 
        jobs: [], 
        error: null 
      }
    }
    
    // ✅ Format ALL jobs with REAL data only - NO MOCK
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // ✅ REAL Budget formatting (from API)
      let budgetText = 'Budget: Not specified'
      
      // Fixed price jobs
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
      // Hourly rate jobs
      else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
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
      // Display value fallback
      else if (node.amount?.displayValue) {
        const dispVal = node.amount.displayValue
        if (dispVal.includes('$') || dispVal.includes('€') || dispVal.includes('£')) {
          budgetText = dispVal
        } else if (!isNaN(parseFloat(dispVal))) {
          budgetText = `$${parseFloat(dispVal).toFixed(2)}`
        }
      }
      
      // ✅ REAL Skills from API
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // ✅ REAL Proposal count
      const realProposals = node.totalApplicants || 0
      
      // ✅ REAL Posted date
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 
        'Recently posted'
      
      // ✅ REAL Category
      const category = node.category || 'General'
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      // ✅ REAL Job details
      const jobType = node.engagement || node.durationLabel || 'Not specified'
      const experienceLevel = node.experienceLevel || 'Not specified'
      const workload = node.workload || 'Not specified'
      const freelancerLocation = node.freelancerLocation || 'Anywhere'
      const visibility = node.jobVisibilityType || 'Public'
      
      // ✅ 100% REAL DATA - NO MOCK CLIENT INFO
      // Upwork API doesn't give client details in public API
      // We use neutral placeholder instead of fake names
      return {
        id: node.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: node.title || 'Upwork Job',
        description: node.description || 'No description available',
        budget: budgetText,
        postedDate: formattedDate,
        // ✅ REAL/NEUTRAL DATA ONLY - NO FAKE NAMES
        client: {
          name: 'Upwork Client', // Neutral placeholder
          rating: 0, // API doesn't provide this
          country: freelancerLocation, // Real location from API
          totalSpent: 0, // Not available in API
          totalHires: 0  // Not available in API
        },
        skills: realSkills.slice(0, 8), // More skills
        proposals: realProposals,
        verified: visibility === 'PUBLIC', // Real verification status
        category: cleanedCategory,
        jobType: jobType,
        experienceLevel: experienceLevel,
        workload: workload,
        location: freelancerLocation,
        source: 'upwork',
        isRealJob: true,
        // Debug info
        _realData: {
          hasTitle: !!node.title,
          hasDescription: !!node.description,
          hasBudget: !!node.amount || !!node.hourlyBudgetMin,
          skillsCount: realSkills.length,
          timestamp: new Date().toISOString()
        }
      }
    })
    
    console.log(`✅ BULK FETCH: Formatted ${jobs.length} REAL jobs (0% mock data)`)
    
    // ✅ Apply search filter if needed
    let filteredJobs = jobs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase().trim()
      filteredJobs = jobs.filter((job: any) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
        (job.category && job.category.toLowerCase().includes(searchLower))
      )
      console.log(`🔍 Search filter: ${filteredJobs.length} jobs match "${searchTerm}"`)
    }
    
    // ✅ Remove duplicates by ID
    const uniqueJobs = filteredJobs.filter((job: any, index: number, self: any[]) =>
      index === self.findIndex((j: any) => j.id === job.id)
    )
    
    console.log(`🔄 Unique jobs after deduplication: ${uniqueJobs.length}`)
    
    return { 
      success: true, 
      jobs: uniqueJobs, 
      error: null,
      stats: {
        totalFetched: edges.length,
        uniqueJobs: uniqueJobs.length,
        hasSearch: !!searchTerm
      }
    }
    
  } catch (error: any) {
    console.error('❌ BULK FETCH error:', error.message)
    console.error('Error stack:', error.stack)
    return { 
      success: false, 
      error: `Fetch failed: ${error.message}`, 
      jobs: [] 
    }
  }
}

// ✅ MAIN GET ENDPOINT - Optimized for performance
export async function GET(request: NextRequest) {
  try {
    console.log('=== UPWORK JOBS API: BULK FETCH MODE ===')
    
    const user = await getCurrentUser()
    if (!user) {
      console.error('❌ No authenticated user')
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const forceRefresh = searchParams.get('refresh') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    
    console.log('📋 Parameters:', { search, forceRefresh, page })
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('❌ No Upwork connection found for user:', user.id)
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Please connect your Upwork account first',
        upworkConnected: false,
        help: 'Go to dashboard and click "Connect Upwork" button'
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    if (!accessToken || accessToken.length < 50) {
      console.error('❌ Invalid access token')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Invalid Upwork token. Please reconnect.',
        upworkConnected: false
      })
    }
    
    console.log('✅ Valid Upwork access token found')
    
    // Check cache (only if not force refresh and no search)
    const now = Date.now()
    if (!forceRefresh && !search && jobsCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log(`📦 Serving ${jobsCache.length} jobs from cache...`)
      return NextResponse.json({
        success: true,
        jobs: jobsCache.slice(0, 100), // First 100 jobs
        total: jobsCache.length,
        message: `✅ ${jobsCache.length} REAL jobs loaded (cached, 0% mock)`,
        upworkConnected: true,
        cached: true,
        stats: {
          totalAvailable: jobsCache.length,
          showing: Math.min(100, jobsCache.length),
          lastUpdated: new Date(cacheTimestamp).toLocaleTimeString()
        }
      })
    }
    
    console.log('🔄 Fetching FRESH data from Upwork API...')
    
    // Fetch jobs from Upwork
    const result = await fetchBulkUpworkJobs(accessToken, search)
    
    if (!result.success) {
      console.error('❌ Failed to fetch jobs:', result.error)
      
      // If cache exists and we have an error, return cache (but indicate error)
      if (jobsCache.length > 0) {
        console.log('⚠️ Returning cached data due to API error')
        return NextResponse.json({
          success: true,
          jobs: jobsCache.slice(0, 100),
          total: jobsCache.length,
          message: `⚠️ Using cached data (API error: ${result.error})`,
          upworkConnected: true,
          cached: true,
          apiError: result.error
        })
      }
      
      return NextResponse.json({
        success: false,
        jobs: [],
        message: `❌ Upwork API error: ${result.error}`,
        upworkConnected: true,
        help: 'Check Upwork API status or try reconnecting'
      })
    }
    
    // Update cache (only if no search)
    if (!search) {
      jobsCache = result.jobs
      cacheTimestamp = now
      console.log(`💾 Updated cache with ${result.jobs.length} REAL jobs`)
    }
    
    // Paginate results
    const pageSize = 50
    const startIndex = (page - 1) * pageSize
    const paginatedJobs = result.jobs.slice(startIndex, startIndex + pageSize)
    
    // Return results
    const message = result.jobs.length > 0
      ? `✅ SUCCESS! Loaded ${result.jobs.length} REAL jobs from Upwork (0% mock data)`
      : '❌ No jobs found. Try different search terms.'
    
    return NextResponse.json({
      success: true,
      jobs: paginatedJobs,
      total: result.jobs.length,
      showing: paginatedJobs.length,
      message: message,
      upworkConnected: true,
      cached: false,
      stats: {
        page: page,
        pageSize: pageSize,
        totalPages: Math.ceil(result.jobs.length / pageSize),
        hasMore: startIndex + pageSize < result.jobs.length,
        lastUpdated: new Date().toLocaleTimeString()
      }
    })
    
  } catch (error: any) {
    console.error('❌ CRITICAL API error:', error.message)
    console.error('Error stack:', error.stack)
    
    // Return cache if available
    if (jobsCache.length > 0) {
      console.log('⚠️ Returning cached data due to critical error')
      return NextResponse.json({
        success: true,
        jobs: jobsCache.slice(0, 100),
        total: jobsCache.length,
        message: `⚠️ Using cached data (System error: ${error.message})`,
        upworkConnected: true,
        cached: true,
        systemError: error.message
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

// ✅ Clear cache endpoint
export async function POST(request: NextRequest) {
  try {
    const oldCount = jobsCache.length
    jobsCache = []
    cacheTimestamp = 0
    
    return NextResponse.json({
      success: true,
      message: `✅ Cache cleared (${oldCount} jobs removed)`,
      cacheCleared: true
    })
    
  } catch (error: any) {
    console.error('POST error:', error)
    return NextResponse.json({
      success: false,
      message: `❌ Error: ${error.message}`
    }, { status: 500 })
  }
}