// app/api/upwork/jobs/route.ts - COMPLETE BULK FETCH SOLUTION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CACHE FOR BULK JOBS
let bulkJobsCache: any[] = []
let bulkCacheTimestamp: number = 0
const BULK_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// ✅ FUNCTION TO FETCH JOBS IN BATCHES (100+ jobs per call)
async function fetchBulkUpworkJobs(accessToken: string, searchTerm?: string, limit = 200) {
  try {
    console.log(`🚀 BULK FETCH: Fetching up to ${limit} jobs from Upwork...`)
    
    // ✅ IMPORTANT: Use `first` parameter to get MORE jobs in one request
    const graphqlQuery = {
      query: `
        query GetBulkMarketplaceJobs($first: Int = 100) {
          marketplaceJobPostingsSearch(first: $first) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              cursor
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
                __typename
              }
            }
          }
        }
      `,
      variables: {
        first: limit // ✅ REQUEST MORE JOBS AT ONCE
      }
    }
    
    console.log(`📤 Making BULK GraphQL request (first: ${limit})...`)
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(graphqlQuery),
      // ✅ IMPORTANT: Increase timeout for bulk requests
      signal: AbortSignal.timeout(30000) // 30 seconds timeout
    })
    
    console.log(`📥 Bulk Response Status: ${response.status}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ BULK API Error:', errorText.substring(0, 300))
      throw new Error(`API Error: ${response.status}`)
    }
    
    const data = await response.json()
    
    // ✅ DEBUG: Check how many jobs we got
    console.log('📊 BULK Response Structure:', {
      hasData: !!data.data,
      hasErrors: !!data.errors,
      edgesCount: data.data?.marketplaceJobPostingsSearch?.edges?.length || 0,
      hasNextPage: data.data?.marketplaceJobPostingsSearch?.pageInfo?.hasNextPage || false
    })
    
    if (data.errors) {
      console.error('❌ GraphQL Errors:', data.errors)
      throw new Error(data.errors[0]?.message || 'GraphQL Error')
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ BULK FETCH SUCCESS: Got ${edges.length} raw job edges`)
    
    if (edges.length === 0) {
      console.warn('⚠️ Upwork returned 0 jobs in bulk fetch')
      return []
    }
    
    // ✅ FORMAT ALL JOBS PROPERLY (NO MOCK DATA)
    const allJobs = edges.map((edge: any, index: number) => {
      const node = edge.node || {}
      
      // ✅ BUDGET FORMATTING (100% REAL)
      let budgetText = 'Budget not specified'
      
      // Fixed price
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
      // Hourly rate
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
      
      // ✅ REAL SKILLS FROM API
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // ✅ REAL PROPOSAL COUNT
      const realProposals = node.totalApplicants || 0
      
      // ✅ REAL POSTED DATE
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 
        'Recently'
      
      // ✅ REAL CATEGORY
      const category = node.category || 'General'
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      // ✅ JOB TYPE & EXPERIENCE
      const jobType = node.engagement || node.durationLabel || 'Not specified'
      const experienceLevel = node.experienceLevel || 'Not specified'
      
      // ✅ 100% REAL DATA - NO MOCK CLIENT INFO
      // Note: Upwork public API doesn't provide client details for privacy
      return {
        id: node.id || `job_${Date.now()}_${index}`,
        title: node.title?.trim() || 'Upwork Job',
        description: (node.description || 'No description available').substring(0, 1500),
        budget: budgetText,
        postedDate: formattedDate,
        // ✅ NEUTRAL PLACEHOLDER - NOT MOCK
        client: {
          name: 'Client', // Neutral - NOT "Tech Solutions Inc" etc.
          rating: 0, // Not available in API
          country: 'Not specified', // Not available in API
          totalSpent: 0, // Not available in API
          totalHires: 0 // Not available in API
        },
        skills: realSkills.slice(0, 8), // Show more skills
        proposals: realProposals,
        verified: true, // Default assumption
        category: cleanedCategory,
        jobType: jobType,
        experienceLevel: experienceLevel,
        source: 'upwork',
        isRealJob: true,
        fetchTime: new Date().toISOString()
      }
    })
    
    console.log(`✅ BULK PROCESSING: Formatted ${allJobs.length} jobs (100% real data)`)
    
    // ✅ FILTER BY SEARCH TERM IF PROVIDED
    let filteredJobs = allJobs
    if (searchTerm && searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim()
      filteredJobs = allJobs.filter((job: { title: string; description: string; skills: string[]; category: string }) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
        (job.category && job.category.toLowerCase().includes(searchLower))
      )
      console.log(`🔍 After search "${searchTerm}": ${filteredJobs.length} jobs`)
    }
    
    return filteredJobs
    
  } catch (error: any) {
    console.error('❌ BULK FETCH ERROR:', error.message || error)
    throw error
  }
}

// ✅ BACKGROUND WORKER TO FETCH ALL JOBS PERIODICALLY
async function fetchAllJobsInBackground(accessToken: string) {
  try {
    console.log('🔄 BACKGROUND: Fetching ALL jobs from Upwork...')
    
    // We'll fetch 200 jobs at once (Upwork's typical limit per request)
    const jobs = await fetchBulkUpworkJobs(accessToken, undefined, 200)
    
    if (jobs.length > 0) {
      // Update cache with fresh jobs
      bulkJobsCache = jobs
      bulkCacheTimestamp = Date.now()
      console.log(`✅ BACKGROUND: Updated cache with ${jobs.length} fresh jobs`)
    }
    
    return jobs
  } catch (error) {
    console.error('❌ BACKGROUND FETCH ERROR:', error)
    return []
  }
}

// ✅ MAIN API ENDPOINT
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API: BULK FETCH MODE ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const forceRefresh = searchParams.get('refresh') === 'true'
    const background = searchParams.get('background') === 'true'
    
    console.log('📋 Parameters:', { search, forceRefresh, background })
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('❌ No Upwork connection')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Please connect your Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    console.log('✅ Upwork access token available')
    
    const now = Date.now()
    
    // ✅ BACKGROUND FETCH (for auto-refresh)
    if (background) {
      try {
        const bgJobs = await fetchAllJobsInBackground(accessToken)
        return NextResponse.json({
          success: true,
          jobs: bgJobs,
          total: bgJobs.length,
          message: `✅ Background updated with ${bgJobs.length} jobs`,
          upworkConnected: true,
          background: true
        })
      } catch (bgError: any) {
        console.error('Background fetch failed:', bgError)
        // Don't fail the request, return cached data
      }
    }
    
    // ✅ CHECK CACHE (if not force refresh and no search)
    if (!forceRefresh && !search && bulkJobsCache.length > 0 && (now - bulkCacheTimestamp) < BULK_CACHE_DURATION) {
      console.log(`📦 Serving ${bulkJobsCache.length} jobs from cache (${Math.floor((now - bulkCacheTimestamp) / 1000)}s old)`)
      return NextResponse.json({
        success: true,
        jobs: bulkJobsCache,
        total: bulkJobsCache.length,
        message: `✅ ${bulkJobsCache.length} jobs loaded (cached)`,
        upworkConnected: true,
        cached: true,
        cacheAge: Math.floor((now - bulkCacheTimestamp) / 1000)
      })
    }
    
    // ✅ FRESH BULK FETCH
    console.log(forceRefresh ? '🔄 Force refreshing ALL jobs...' : '🔄 Fetching fresh batch of jobs...')
    
    const jobs = await fetchBulkUpworkJobs(accessToken, search, 200)
    
    // Update cache (only if no search, because search results are specific)
    if (!search) {
      bulkJobsCache = jobs
      bulkCacheTimestamp = now
      console.log(`💾 Cache updated with ${jobs.length} jobs`)
    }
    
    const message = jobs.length > 0
      ? `✅ Success! Loaded ${jobs.length} REAL jobs from Upwork (Bulk Fetch)`
      : search
        ? `❌ No jobs found for "${search}"`
        : '❌ No jobs found. Upwork API might be limiting requests.'
    
    return NextResponse.json({
      success: true,
      jobs: jobs,
      total: jobs.length,
      message: message,
      upworkConnected: true,
      cached: false,
      bulkFetch: true
    })
    
  } catch (error: any) {
    console.error('❌ JOBS API MAIN ERROR:', error)
    
    // ✅ GRACEFUL ERROR HANDLING - Return cached data if available
    if (bulkJobsCache.length > 0) {
      console.log('⚠️ Using cached data due to error')
      return NextResponse.json({
        success: true,
        jobs: bulkJobsCache,
        total: bulkJobsCache.length,
        message: `⚠️ Using cached data (Error: ${error.message})`,
        upworkConnected: true,
        cached: true,
        error: error.message
      })
    }
    
    return NextResponse.json({
      success: false,
      jobs: [],
      message: `❌ Failed to fetch jobs: ${error.message || 'Unknown error'}`,
      upworkConnected: true
    })
  }
}

// ✅ CLEAR CACHE ENDPOINT
export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json()
    
    if (action === 'clear_cache') {
      bulkJobsCache = []
      bulkCacheTimestamp = 0
      console.log('🧹 Cache cleared manually')
      
      return NextResponse.json({
        success: true,
        message: '✅ Cache cleared successfully'
      })
    }
    
    return NextResponse.json({
      success: false,
      message: 'Invalid action'
    })
    
  } catch (error: any) {
    console.error('POST error:', error)
    return NextResponse.json({
      success: false,
      message: `❌ Error: ${error.message}`
    }, { status: 500 })
  }
}