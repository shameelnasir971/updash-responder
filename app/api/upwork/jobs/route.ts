import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Cache system
let jobsCache: any = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

// ✅ WORKING: Fetch jobs with pagination
async function fetchUpworkJobsWithPagination(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 [PAGINATED] Fetching jobs with pagination...')
    
    // ✅ IMPORTANT: Use FIRST parameter to get more jobs
    const graphqlQuery = {
      query: `
        query GetJobsWithPagination {
          marketplaceJobPostingsSearch(
            first: 50  # ✅ Get 50 jobs per request
          ) {
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
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `
    }
    
    console.log('📡 Sending GraphQL query with first: 50...')
    
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
      console.error('❌ API request failed:', errorText.substring(0, 300))
      // Fallback to simple query
      return await fetchUpworkJobsSimple(accessToken, searchTerm)
    }
    
    const data = await response.json()
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      // Fallback to simple query
      return await fetchUpworkJobsSimple(accessToken, searchTerm)
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Page 1: Found ${edges.length} jobs`)
    
    let allJobs = [...edges]
    let pageInfo = data.data?.marketplaceJobPostingsSearch?.pageInfo
    let hasNextPage = pageInfo?.hasNextPage
    let endCursor = pageInfo?.endCursor
    let pageCount = 1
    
    // ✅ Fetch additional pages (up to 3 pages total = 150 jobs)
    const MAX_PAGES = 3
    
    while (hasNextPage && pageCount < MAX_PAGES) {
      try {
        pageCount++
        console.log(`📄 Fetching page ${pageCount} with cursor...`)
        
        const nextPageQuery = {
          query: `
            query GetJobsPage($after: String) {
              marketplaceJobPostingsSearch(
                first: 50
                after: $after
              ) {
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
                pageInfo {
                  hasNextPage
                  endCursor
                }
              }
            }
          `,
          variables: { after: endCursor }
        }
        
        const nextResponse = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(nextPageQuery)
        })
        
        if (!nextResponse.ok) {
          console.log(`⚠️ Page ${pageCount} request failed`)
          break
        }
        
        const nextData = await nextResponse.json()
        
        if (nextData.errors) {
          console.error(`Page ${pageCount} errors:`, nextData.errors)
          break
        }
        
        const nextEdges = nextData.data?.marketplaceJobPostingsSearch?.edges || []
        console.log(`✅ Page ${pageCount}: Added ${nextEdges.length} jobs`)
        
        allJobs.push(...nextEdges)
        
        pageInfo = nextData.data?.marketplaceJobPostingsSearch?.pageInfo
        hasNextPage = pageInfo?.hasNextPage
        endCursor = pageInfo?.endCursor
        
        // Wait to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 800))
        
      } catch (pageError: any) {
        console.error(`Page ${pageCount} error:`, pageError.message)
        break
      }
    }
    
    console.log(`🎯 Total jobs fetched: ${allJobs.length} from ${pageCount} pages`)
    
    // ✅ Format jobs
    const formattedJobs = allJobs.map((edge: any) => {
      const node = edge.node || {}
      
      // Budget formatting
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
      } else if (node.amount?.displayValue) {
        const dispVal = node.amount.displayValue
        if (dispVal.includes('$') || dispVal.includes('€') || dispVal.includes('£')) {
          budgetText = dispVal
        } else if (!isNaN(parseFloat(dispVal))) {
          budgetText = `$${parseFloat(dispVal).toFixed(2)}`
        }
      }
      
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || 
                        ['Skills not specified']
      
      const realProposals = node.totalApplicants || 0
      
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently'
      
      const category = node.category || 'General'
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      return {
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || 'Job Description',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: 'Client',
          rating: 0,
          country: 'Not specified',
          totalSpent: 0,
          totalHires: 0
        },
        skills: realSkills.slice(0, 5),
        proposals: realProposals,
        verified: true,
        category: cleanedCategory,
        jobType: node.engagement || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        postedTimestamp: postedDate ? new Date(postedDate).getTime() : Date.now(),
        _page: pageCount
      }
    })
    
    // Remove duplicates
    const uniqueJobs = Array.from(
      new Map(formattedJobs.map(job => [job.id, job])).values()
    )
    
    console.log(`✅ Unique jobs: ${uniqueJobs.length}`)
    
    // Sort by latest
    uniqueJobs.sort((a: any, b: any) => b.postedTimestamp - a.postedTimestamp)
    
    // Apply search filter
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
      pagesFetched: pageCount,
      hasMore: hasNextPage,
      error: null 
    }
    
  } catch (error: any) {
    console.error('❌ Paginated fetch error:', error.message)
    return await fetchUpworkJobsSimple(accessToken, searchTerm)
  }
}

// ✅ SIMPLE: Fallback function
async function fetchUpworkJobsSimple(accessToken: string, searchTerm?: string) {
  try {
    console.log('🔄 Using simple fetch...')
    
    const graphqlQuery = {
      query: `
        query GetSimpleJobs {
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
      throw new Error(`API failed: ${response.status}`)
    }
    
    const data = await response.json()
    
    if (data.errors) {
      throw new Error(data.errors[0]?.message || 'GraphQL error')
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Simple fetch: ${edges.length} jobs`)
    
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      let budgetText = 'Budget not specified'
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        budgetText = formatCurrency(rawValue, currency)
      }
      
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || 
                        ['Skills not specified']
      
      const postedDate = node.createdDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently'
      
      return {
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || 'Job Description',
        budget: budgetText,
        postedDate: formattedDate,
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
        category: node.category || 'General',
        jobType: 'Not specified',
        experienceLevel: 'Not specified',
        source: 'upwork',
        isRealJob: true,
        postedTimestamp: postedDate ? new Date(postedDate).getTime() : Date.now()
      }
    })
    
    // Apply search filter
    let filteredJobs = jobs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredJobs = jobs.filter((job: { title: string; description: string; skills: string[] }) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
      )
    }
    
    return { 
      success: true, 
      jobs: filteredJobs, 
      totalCount: filteredJobs.length,
      pagesFetched: 1,
      hasMore: false,
      error: null 
    }
    
  } catch (error: any) {
    console.error('Simple fetch error:', error.message)
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

// ✅ MAIN API ROUTE
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API: PAGINATED MODE ===')
    
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
    const simpleMode = searchParams.get('simple') === 'true'
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
    
    // Choose fetch mode
    let result
    if (simpleMode) {
      result = await fetchUpworkJobsSimple(accessToken, search)
    } else {
      result = await fetchUpworkJobsWithPagination(accessToken, search)
    }
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: `Failed: ${result.error}`,
        upworkConnected: true
      })
    }
    
    // Update cache (only if no search)
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
      pagesFetched: result.pagesFetched || 1,
      message: result.jobs.length === 0 
        ? (search ? `No jobs found for "${search}"` : 'No jobs found')
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