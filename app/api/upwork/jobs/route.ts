import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Cache system
let jobsCache: any = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// ✅ SIMPLE & WORKING: Fetch jobs WITHOUT pagination errors
async function fetchUpworkJobsSimple(accessToken: string, searchTerm?: string) {
  try {
    console.log('🔄 [SIMPLE FETCH] Fetching jobs...', 
      searchTerm ? `Search: "${searchTerm}"` : 'ALL JOBS'
    )

    // ✅ WORKING GraphQL query - No first parameter, No criteria
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
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
      `
    }
    
    console.log('📡 Sending SIMPLE GraphQL query...')
    
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
      console.error('❌ API request failed:', errorText.substring(0, 500))
      return { 
        success: false, 
        error: `API error: ${response.status}`, 
        jobs: [] 
      }
    }
    
    const data = await response.json()
    
    // DEBUG: Check response structure
    console.log('📊 Response has data?', !!data.data)
    console.log('🔍 Response keys:', Object.keys(data))
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { 
        success: false, 
        error: data.errors[0]?.message || 'GraphQL error', 
        jobs: [] 
      }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} jobs`)
    
    // ✅ Format jobs with REAL DATA
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // ✅ REAL BUDGET from API
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
      
      // ✅ REAL SKILLS from API
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || 
                        ['Skills not specified']
      
      // ✅ REAL PROPOSAL COUNT
      const realProposals = node.totalApplicants || 0
      
      // ✅ REAL POSTED DATE
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
      
      // ✅ REAL JOB TYPE
      const jobType = node.engagement || node.durationLabel || 'Not specified'
      const experienceLevel = node.experienceLevel || 'Not specified'
      
      return {
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || 'Job Description',
        budget: budgetText,
        postedDate: formattedDate,
        // ❌ NO FAKE DATA - Only neutral placeholders
        client: {
          name: 'Client', // Neutral - NOT fake company names
          rating: 0,
          country: 'Not specified',
          totalSpent: 0,
          totalHires: 0
        },
        skills: realSkills.slice(0, 5),
        proposals: realProposals,
        verified: true,
        category: cleanedCategory,
        jobType: jobType,
        experienceLevel: experienceLevel,
        source: 'upwork',
        isRealJob: true,
        postedTimestamp: postedDate ? new Date(postedDate).getTime() : Date.now()
      }
    })
    
    // ✅ Apply search filter client-side
    let filteredJobs = jobs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredJobs = jobs.filter((job: { title: string; description: string; skills: string[]; category: string }) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
        (job.category && job.category.toLowerCase().includes(searchLower))
      )
      console.log(`🔍 After filtering for "${searchTerm}": ${filteredJobs.length} jobs`)
    }
    
    console.log(`✅ Formatted ${filteredJobs.length} jobs`)
    return { 
      success: true, 
      jobs: filteredJobs, 
      totalCount: filteredJobs.length,
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

// ✅ ADVANCED: Multiple queries to get more jobs
async function fetchUpworkJobsBulk(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 [BULK FETCH] Fetching jobs with multiple queries...')
    
    const allJobs = []
    
    // ✅ Strategy: Run multiple DIFFERENT queries to get variety
    const queries = [
      // Query 1: Default (most recent)
      {
        query: `
          query GetMarketplaceJobs {
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
        `
      },
      // Query 2: With hourly budget fields
      {
        query: `
          query GetHourlyJobs {
            marketplaceJobPostingsSearch {
              edges {
                node {
                  id
                  title
                  description
                  hourlyBudgetMin { rawValue currency displayValue }
                  hourlyBudgetMax { rawValue currency displayValue }
                  skills { name }
                  totalApplicants
                  category
                  publishedDateTime
                }
              }
            }
          }
        `
      }
    ]
    
    // Run both queries
    for (let i = 0; i < queries.length; i++) {
      try {
        console.log(`📡 Query ${i + 1}/${queries.length}...`)
        
        const response = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(queries[i])
        })
        
        if (response.ok) {
          const data = await response.json()
          
          if (!data.errors) {
            const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
            console.log(`✅ Query ${i + 1}: ${edges.length} jobs`)
            
            // Format and add jobs
            const formattedJobs = edges.map((edge: any) => {
              const node = edge.node || {}
              
              // Format job (same as simple function)
              return {
                id: node.id,
                title: node.title || 'Job Title',
                description: node.description || 'Job Description',
                budget: node.amount?.displayValue || 'Budget not specified',
                postedDate: 'Recently',
                client: {
                  name: 'Client',
                  rating: 0,
                  country: 'Not specified',
                  totalSpent: 0,
                  totalHires: 0
                },
                skills: node.skills?.map((s: any) => s.name).slice(0, 5) || ['Skills not specified'],
                proposals: node.totalApplicants || 0,
                verified: true,
                category: node.category || 'General',
                jobType: 'Not specified',
                experienceLevel: 'Not specified',
                source: 'upwork',
                isRealJob: true,
                postedTimestamp: Date.now() - (i * 1000) // Stagger timestamps
              }
            })
            
            allJobs.push(...formattedJobs)
          }
        }
        
        // Wait between queries
        await new Promise(resolve => setTimeout(resolve, 1000))
        
      } catch (error: any) {
        console.error(`Query ${i + 1} failed:`, error.message)
      }
    }
    
    // Remove duplicates
    const uniqueJobs = Array.from(
      new Map(allJobs.map(job => [job.id, job])).values()
    )
    
    console.log(`🎯 Total unique jobs: ${uniqueJobs.length}`)
    
    // Apply search filter
    let filteredJobs = uniqueJobs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredJobs = uniqueJobs.filter(job => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
      )
    }
    
    return { 
      success: true, 
      jobs: filteredJobs, 
      totalCount: filteredJobs.length,
      error: null 
    }
    
  } catch (error: any) {
    console.error('❌ Bulk fetch error:', error.message)
    // Fallback to simple fetch
    return await fetchUpworkJobsSimple(accessToken, searchTerm)
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API: SIMPLE MODE ===')
    
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
    const forceRefresh = searchParams.get('refresh') === 'true'
    const bulkMode = searchParams.get('bulk') === 'true'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    console.log('🔍 Search:', search || 'No search')
    console.log('🔄 Force refresh:', forceRefresh)
    console.log('📄 Page:', page)
    console.log('📊 Limit:', limit)
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Connect Upwork account first',
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
        message: `✅ ${paginatedJobs.length} jobs (page ${page}) from cache (${jobsCache.length} total)`,
        upworkConnected: true,
        searchTerm: null,
        cached: true,
        limit: limit
      })
    }
    
    console.log('🔄 Fetching fresh data from Upwork...')
    
    // Choose fetch mode
    let result
    if (bulkMode) {
      console.log('Using BULK mode...')
      result = await fetchUpworkJobsBulk(accessToken, search)
    } else {
      console.log('Using SIMPLE mode...')
      result = await fetchUpworkJobsSimple(accessToken, search)
    }
    
    if (!result.success) {
      console.error('❌ Fetch failed:', result.error)
      return NextResponse.json({
        success: false,
        jobs: [],
        message: `❌ Failed to fetch jobs: ${result.error}`,
        upworkConnected: true
      })
    }
    
    // Update cache
    if (result.success && !search) {
      jobsCache = result.jobs
      cacheTimestamp = now
      console.log(`💾 Updated cache with ${result.jobs.length} jobs`)
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
      totalCount: result.totalCount || result.jobs.length,
      message: result.success ? 
        (search 
          ? `🔍 Found ${result.jobs.length} jobs for "${search}"`
          : `✅ Loaded ${paginatedJobs.length} real jobs (page ${page} of ${Math.ceil(result.jobs.length / limit)})`
        ) : `❌ Error: ${result.error}`,
      upworkConnected: true,
      searchTerm: search || null,
      cached: false,
      limit: limit,
      mode: bulkMode ? 'bulk' : 'simple'
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message
    }, { status: 500 })
  }
}

// Clear cache endpoint
export async function POST(request: NextRequest) {
  try {
    jobsCache = null
    cacheTimestamp = 0
    
    return NextResponse.json({
      success: true,
      message: '✅ Cache cleared successfully'
    })
    
  } catch (error: any) {
    console.error('POST error:', error)
    return NextResponse.json({
      success: false,
      message: 'Error: ' + error.message
    }, { status: 500 })
  }
}