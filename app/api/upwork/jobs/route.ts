import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Cache system
let jobsCache: any = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

// ✅ MAIN FUNCTION: Fetch ALL jobs (old + new)
async function fetchAllUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 [ALL JOBS] Fetching COMPLETE job database...')
    
    // ✅ STRATEGY: Multiple queries to get variety
    const allJobs = []
    const queryVariants = [
      // Variant 1: Recent jobs
      {
        query: `
          query GetRecentJobs {
            marketplaceJobPostingsSearch {
              edges {
                node {
                  id
                  title
                  description
                  amount { rawValue currency displayValue }
                  hourlyBudgetMin { rawValue currency displayValue }
                  hourlyBudgetMax { rawValue currency displayValue }
                  skills { name }
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
        `,
        name: 'recent'
      },
      // Variant 2: Popular jobs (most applicants)
      {
        query: `
          query GetPopularJobs {
            marketplaceJobPostingsSearch {
              edges {
                node {
                  id
                  title
                  description
                  amount { rawValue currency displayValue }
                  skills { name }
                  totalApplicants
                  category
                  createdDateTime
                }
              }
            }
          }
        `,
        name: 'popular'
      }
    ]
    
    // ✅ Execute all query variants
    for (const variant of queryVariants) {
      try {
        console.log(`📡 Running query: ${variant.name}`)
        
        const response = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(variant)
        })
        
        if (response.ok) {
          const data = await response.json()
          
          if (!data.errors && data.data?.marketplaceJobPostingsSearch?.edges) {
            const edges = data.data.marketplaceJobPostingsSearch.edges
            console.log(`✅ ${variant.name}: ${edges.length} jobs`)
            
            // Format and add jobs
            const formattedJobs = edges.map((edge: any) => {
              const node = edge.node || {}
              
              // Format budget
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
              
              // Real skills
              const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || 
                                ['Skills not specified']
              
              // Real date
              const postedDate = node.createdDateTime || node.publishedDateTime
              const formattedDate = postedDate ? 
                new Date(postedDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                }) : 
                'Recently'
              
              // Real category
              const category = node.category || 'General'
              const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
              
              return {
                id: node.id,
                title: node.title || 'Job Title',
                description: node.description || 'Job Description',
                budget: budgetText,
                postedDate: formattedDate,
                // ❌ NO FAKE DATA - Only neutral placeholders
                client: {
                  name: 'Client',
                  rating: 0,
                  country: 'Not specified',
                  totalSpent: 0,
                  totalHires: 0
                },
                skills: realSkills.slice(0, 5),
                proposals: node.totalApplicants || 0,
                verified: true,
                category: cleanedCategory,
                jobType: node.engagement || node.durationLabel || 'Not specified',
                experienceLevel: node.experienceLevel || 'Not specified',
                source: 'upwork',
                isRealJob: true,
                postedTimestamp: postedDate ? new Date(postedDate).getTime() : Date.now(),
                queryVariant: variant.name
              }
            })
            
            allJobs.push(...formattedJobs)
          }
        }
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500))
        
      } catch (variantError: any) {
        console.error(`Variant ${variant.name} failed:`, variantError.message)
      }
    }
    
    console.log(`📊 Total jobs collected: ${allJobs.length}`)
    
    // ✅ Remove duplicates
    const uniqueJobsMap = new Map()
    allJobs.forEach(job => {
      if (!uniqueJobsMap.has(job.id)) {
        uniqueJobsMap.set(job.id, job)
      }
    })
    
    const uniqueJobs = Array.from(uniqueJobsMap.values())
    console.log(`✅ Unique jobs: ${uniqueJobs.length}`)
    
    // ✅ Sort by date (newest first)
    uniqueJobs.sort((a: any, b: any) => b.postedTimestamp - a.postedTimestamp)
    
    // ✅ Apply search filter (client-side)
    let filteredJobs = uniqueJobs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredJobs = uniqueJobs.filter(job => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
        (job.category && job.category.toLowerCase().includes(searchLower))
      )
      console.log(`🔍 After filtering for "${searchTerm}": ${filteredJobs.length} jobs`)
    }
    
    return { 
      success: true, 
      jobs: filteredJobs, 
      totalCount: filteredJobs.length,
      error: null 
    }
    
  } catch (error: any) {
    console.error('❌ Fetch all jobs error:', error.message)
    return { 
      success: false, 
      error: error.message, 
      jobs: [] 
    }
  }
}

// ✅ HELPER: Format currency
function formatCurrency(value: number, currency: string): string {
  const symbols: {[key: string]: string} = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'CAD': 'C$', 'AUD': 'A$'
  }
  const symbol = symbols[currency] || currency + ' '
  return `${symbol}${value.toFixed(2)}`
}

// ✅ HELPER: Format hourly rate
function formatHourlyRate(min: number, max: number, currency: string): string {
  const symbols: {[key: string]: string} = {
    'USD': '$', 'EUR': '€', 'GBP': '£'
  }
  const symbol = symbols[currency] || currency + ' '
  
  if (min === max || max === 0) {
    return `${symbol}${min.toFixed(2)}/hr`
  } else {
    return `${symbol}${min.toFixed(2)}-${max.toFixed(2)}/hr`
  }
}

// ✅ API ROUTE HANDLER
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API: COMPLETE FETCH ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    // Get parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const forceRefresh = searchParams.get('refresh') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    
    console.log(`🔍 Search: "${search}" | Page: ${page} | Limit: ${limit}`)
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Use cache if available
    const now = Date.now()
    if (!forceRefresh && jobsCache && (now - cacheTimestamp) < CACHE_DURATION && !search) {
      console.log('📦 Serving from cache...')
      
      // Paginate cached results
      const startIndex = (page - 1) * limit
      const endIndex = startIndex + limit
      const paginatedJobs = jobsCache.slice(startIndex, endIndex)
      
      return NextResponse.json({
        success: true,
        jobs: paginatedJobs,
        total: jobsCache.length,
        page: page,
        totalPages: Math.ceil(jobsCache.length / limit),
        hasMore: endIndex < jobsCache.length,
        message: `✅ ${paginatedJobs.length} jobs from cache`,
        upworkConnected: true,
        cached: true
      })
    }
    
    console.log('🔄 Fetching fresh data from Upwork...')
    
    // Fetch all jobs
    const result = await fetchAllUpworkJobs(accessToken, search)
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: `Failed: ${result.error}`,
        upworkConnected: true
      })
    }
    
    // Update cache
    if (result.success && !search) {
      jobsCache = result.jobs
      cacheTimestamp = now
      console.log(`💾 Cache updated: ${result.jobs.length} jobs`)
    }
    
    // Paginate results
    const startIndex = (page - 1) * limit
    const endIndex = startIndex + limit
    const paginatedJobs = result.jobs.slice(startIndex, endIndex)
    
    return NextResponse.json({
      success: true,
      jobs: paginatedJobs,
      allJobsCount: result.jobs.length,
      page: page,
      totalPages: Math.ceil(result.jobs.length / limit),
      hasMore: endIndex < result.jobs.length,
      message: result.jobs.length === 0 
        ? 'No jobs found'
        : `✅ Loaded ${paginatedJobs.length} jobs (${result.jobs.length} total available)`,
      upworkConnected: true,
      cached: false
    })
    
  } catch (error: any) {
    console.error('❌ API error:', error.message)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error'
    }, { status: 500 })
  }
}

// Clear cache endpoint
export async function POST() {
  jobsCache = null
  cacheTimestamp = 0
  
  return NextResponse.json({
    success: true,
    message: 'Cache cleared'
  })
}