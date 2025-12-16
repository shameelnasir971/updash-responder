// app/api/upwork/jobs/route.ts - MULTIPLE CATEGORIES VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Upwork job categories for multiple fetches
const UPWORK_CATEGORIES = [
  'Web Development',
  'Mobile Development', 
  'Design & Creative',
  'Writing & Translation',
  'Admin Support',
  'Customer Service',
  'Marketing & Sales',
  'Accounting & Consulting',
  'IT & Networking',
  'Data Science & Analytics'
]

// Cache system
let jobsCache: any[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

// ✅ MULTIPLE FETCHES by Category
async function fetchMultipleUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 MULTIPLE FETCH: Starting...', searchTerm ? `Search: "${searchTerm}"` : '')
    
    let allJobs: any[] = []
    const batchSize = 3 // How many categories to fetch at once
    const maxJobs = 50 // Target total jobs
    
    // If searching, just do one fetch with search
    if (searchTerm) {
      console.log('🔍 Search mode - single fetch')
      const result = await fetchUpworkJobsByCategory(accessToken, searchTerm)
      return result
    }
    
    // ✅ Fetch multiple categories (in batches to avoid rate limiting)
    for (let i = 0; i < Math.min(UPWORK_CATEGORIES.length, 5); i += batchSize) {
      const batch = UPWORK_CATEGORIES.slice(i, i + batchSize)
      console.log(`📦 Fetching batch ${i/batchSize + 1}: ${batch.join(', ')}`)
      
      // Fetch each category in batch
      const promises = batch.map(category => 
        fetchUpworkJobsByCategory(accessToken, undefined, category)
      )
      
      const batchResults = await Promise.all(promises)
      
      // Combine results
      batchResults.forEach(result => {
        if (result.success && result.jobs.length > 0) {
          // Filter duplicates
          const existingIds = new Set(allJobs.map(j => j.id))
          const newJobs = result.jobs.filter((job: any) => !existingIds.has(job.id))
          allJobs = [...allJobs, ...newJobs]
        }
      })
      
      console.log(`✅ Batch complete. Total so far: ${allJobs.length} unique jobs`)
      
      // Stop if we have enough jobs
      if (allJobs.length >= maxJobs) {
        console.log(`🎯 Reached target of ${maxJobs} jobs`)
        break
      }
      
      // Wait between batches to avoid rate limiting
      if (i + batchSize < UPWORK_CATEGORIES.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }
    
    console.log(`✅ TOTAL: ${allJobs.length} unique jobs from multiple categories`)
    
    // Shuffle jobs for variety
    const shuffledJobs = [...allJobs].sort(() => Math.random() - 0.5)
    
    return { 
      success: true, 
      jobs: shuffledJobs.slice(0, maxJobs), // Limit to maxJobs
      error: null 
    }
    
  } catch (error: any) {
    console.error('❌ Multiple fetch error:', error.message)
    return { 
      success: false, 
      error: error.message, 
      jobs: []
    }
  }
}

// ✅ SINGLE CATEGORY FETCH
async function fetchUpworkJobsByCategory(accessToken: string, searchTerm?: string, category?: string) {
  try {
    console.log('📤 Fetching jobs...', {
      search: searchTerm,
      category: category
    })
    
    // ✅ Working GraphQL query (proven to work)
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch {
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
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API request failed:', errorText.substring(0, 200))
      return { 
        success: false, 
        error: `API error: ${response.status}`, 
        jobs: []
      }
    }
    
    const data = await response.json()
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { 
        success: false, 
        error: data.errors[0]?.message, 
        jobs: []
      }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} raw jobs`)
    
    if (edges.length === 0) {
      return { 
        success: true, 
        jobs: [], 
        error: null 
      }
    }
    
    // ✅ Format jobs
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // Budget formatting
      let budgetText = 'Budget not specified'
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        budgetText = formatCurrency(rawValue, currency)
      } else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
        const minVal = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : 0
        const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal
        const currency = node.hourlyBudgetMin?.currency || node.hourlyBudgetMax?.currency || 'USD'
        budgetText = formatHourlyRate(minVal, maxVal, currency)
      }
      
      // Skills
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // Date
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        }) : 
        'Recently'
      
      // Category
      const jobCategory = node.category || category || 'General'
      const cleanedCategory = formatCategory(jobCategory)
      
      return {
        id: node.id,
        title: node.title || 'Job',
        description: node.description || '',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: 'Client',
          rating: 0,
          country: 'Remote',
          totalSpent: 0,
          totalHires: 0
        },
        skills: realSkills,
        proposals: node.totalApplicants || 0,
        verified: true,
        category: cleanedCategory,
        jobType: node.engagement || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        _sourceCategory: category || 'default'
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} jobs`)
    
    // Apply search filter if provided
    let filteredJobs = jobs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredJobs = jobs.filter((job: { title: string; description: string; skills: string[] }) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
      )
    }
    
    // Apply category filter if provided
    if (category && !searchTerm) {
      const categoryLower = category.toLowerCase()
      filteredJobs = jobs.filter((job: { category: string; _sourceCategory: string }) => 
        job.category.toLowerCase().includes(categoryLower) ||
        (job._sourceCategory && job._sourceCategory.toLowerCase().includes(categoryLower))
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

// Helper functions
function formatCurrency(value: number, currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹'
  }
  const symbol = symbols[currency] || currency + ' '
  return `${symbol}${value.toFixed(2)}`
}

function formatHourlyRate(min: number, max: number, currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$', 'EUR': '€', 'GBP': '£'
  }
  const symbol = symbols[currency] || currency + ' '
  if (min === max || max === 0) {
    return `${symbol}${min.toFixed(2)}/hr`
  } else {
    return `${symbol}${min.toFixed(2)}-${max.toFixed(2)}/hr`
  }
}

function formatCategory(category: string): string {
  return category
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
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
    const mode = searchParams.get('mode') || 'multiple' // 'single' or 'multiple'
    
    console.log('Parameters:', { search, forceRefresh, mode })
    
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
    const cacheKey = search ? `search_${search}` : 'all'
    
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
          message: `✅ ${cachedJobs.length} jobs loaded (from cache${search ? `, search: "${search}"` : ''})`,
          upworkConnected: true,
          cached: true,
          source: 'cache'
        })
      }
    }
    
    console.log('🔄 Fetching fresh data from Upwork API...')
    
    let result
    if (mode === 'multiple' && !search) {
      // Use multiple categories fetch
      result = await fetchMultipleUpworkJobs(accessToken, search)
    } else {
      // Use single fetch (for search or single mode)
      result = await fetchUpworkJobsByCategory(accessToken, search)
    }
    
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
          message: `⚠️ Using cached data (API error: ${result.error})`,
          upworkConnected: true,
          cached: true,
          source: 'cache_fallback'
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
    if (!search && result.jobs.length > 0) {
      jobsCache = result.jobs
      cacheTimestamp = now
      console.log(`💾 Updated cache with ${result.jobs.length} jobs`)
    }
    
    // Prepare message
    let message = ''
    if (search) {
      message = result.jobs.length > 0
        ? `✅ Found ${result.jobs.length} jobs for "${search}"`
        : `❌ No jobs found for "${search}"`
    } else {
      message = result.jobs.length > 0
        ? `✅ Loaded ${result.jobs.length} real jobs from Upwork (multiple categories)`
        : '❌ No jobs found'
    }
    
    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      total: result.jobs.length,
      message: message,
      upworkConnected: true,
      cached: false,
      source: mode === 'multiple' ? 'multiple_categories' : 'single_fetch'
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
        message: `⚠️ Using cached data (Error: ${error.message})`,
        upworkConnected: true,
        cached: true,
        source: 'cache_error_fallback'
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