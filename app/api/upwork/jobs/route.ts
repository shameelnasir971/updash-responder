import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ ADVANCED JOBS FETCHER - Gets ALL jobs
async function fetchAllUpworkJobs(accessToken: string, searchTerm = '', category = '', skipCache = false) {
  try {
    console.log('🚀 Fetching ALL Upwork jobs...', {
      searchTerm,
      category,
      skipCache
    })

    // ✅ PROPER PAGINATION & FILTERING QUERY
    const graphqlQuery = {
      query: `
        query GetAllJobs(
          $first: Int, 
          $after: String, 
          $searchQuery: String, 
          $categories: [String]
        ) {
          marketplaceJobPostingsSearch(
            first: $first,
            after: $after,
            searchQuery: $searchQuery,
            categories: $categories
          ) {
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
                subcategory
                createdDateTime
                publishedDateTime
                experienceLevel
                engagement
                duration
                durationLabel
                client {
                  displayName
                  feedback {
                    overallRating
                  }
                  totalSpent
                  totalHires
                  location {
                    country
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
          }
        }
      `,
      variables: {
        first: 100, // ✅ 100 jobs per request
        after: null,
        searchQuery: searchTerm || null,
        categories: category ? [category] : null
      }
    }

    console.log('📤 Making GraphQL request for 100 jobs...')
    
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
      return { 
        success: false, 
        error: `API error: ${response.status}`, 
        jobs: [],
        total: 0
      }
    }
    
    const data = await response.json()
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { 
        success: false, 
        error: data.errors[0]?.message, 
        jobs: [],
        total: 0
      }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    const totalCount = data.data?.marketplaceJobPostingsSearch?.totalCount || 0
    let hasNextPage = data.data?.marketplaceJobPostingsSearch?.pageInfo?.hasNextPage || false
    const endCursor = data.data?.marketplaceJobPostingsSearch?.pageInfo?.endCursor || null
    
    console.log(`✅ Found ${edges.length} jobs (Total available: ${totalCount})`)
    console.log('Has next page:', hasNextPage, 'End cursor:', endCursor)
    
    // ✅ MULTI-PAGE FETCHING (if more jobs available)
    let allJobs = edges
    let currentCursor = endCursor
    
    // Fetch next pages if available (max 500 jobs)
    if (hasNextPage && !searchTerm && totalCount > 100) {
      console.log('🔍 Fetching additional pages...')
      
      let pageCount = 1
      const maxPages = 5 // Max 500 jobs (100 per page × 5 pages)
      
      while (hasNextPage && pageCount < maxPages) {
        try {
          const nextQuery = {
            ...graphqlQuery,
            variables: {
              ...graphqlQuery.variables,
              after: currentCursor
            }
          }
          
          const nextResponse = await fetch('https://api.upwork.com/graphql', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(nextQuery)
          })
          
          if (!nextResponse.ok) break
          
          const nextData = await nextResponse.json()
          if (nextData.errors) break
          
          const nextEdges = nextData.data?.marketplaceJobPostingsSearch?.edges || []
          allJobs = [...allJobs, ...nextEdges]
          
          currentCursor = nextData.data?.marketplaceJobPostingsSearch?.pageInfo?.endCursor
          hasNextPage = nextData.data?.marketplaceJobPostingsSearch?.pageInfo?.hasNextPage || false
          
          console.log(`📄 Page ${pageCount + 1}: Added ${nextEdges.length} jobs`)
          pageCount++
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500))
          
        } catch (pageError) {
          console.error('Page fetch error:', pageError)
          break
        }
      }
    }
    
    console.log(`🎯 Total jobs fetched: ${allJobs.length}`)
    
    // ✅ Format jobs with REAL data
    const formattedJobs = allJobs.map((edge: any) => {
      const node = edge.node || {}
      
      // REAL BUDGET
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
      
      // REAL CLIENT INFO
      const clientName = node.client?.displayName || 'Client'
      const clientRating = node.client?.feedback?.overallRating || 0
      const clientCountry = node.client?.location?.country || 'Remote'
      const clientSpent = node.client?.totalSpent || 0
      const clientHires = node.client?.totalHires || 0
      
      // REAL SKILLS
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // REAL DATE
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently'
      
      // REAL CATEGORY
      const category = node.category || 'General'
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      return {
        // 100% REAL DATA - NO MOCK
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || '',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: clientName,
          rating: clientRating,
          country: clientCountry,
          totalSpent: clientSpent,
          totalHires: clientHires
        },
        skills: realSkills,
        proposals: node.totalApplicants || 0,
        verified: true,
        category: cleanedCategory,
        subcategory: node.subcategory || '',
        jobType: node.engagement || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        rawData: node // Keep raw for debugging
      }
    })
    
    return { 
      success: true, 
      jobs: formattedJobs, 
      total: formattedJobs.length,
      error: null 
    }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { 
      success: false, 
      error: error.message, 
      jobs: [],
      total: 0
    }
  }
}

// ✅ SMART CACHE SYSTEM
let globalJobsCache: any[] = []
let globalCacheTimestamp: number = 0
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

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
    const category = searchParams.get('category') || ''
    const refresh = searchParams.get('refresh') || 'false'
    const forceRefresh = refresh === 'true'
    
    console.log('Parameters:', { search, category, forceRefresh })
    
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
    
    const now = Date.now()
    const cacheKey = `${search}_${category}`
    
    // Check cache (only if not forcing refresh)
    if (!forceRefresh && globalJobsCache.length > 0 && (now - globalCacheTimestamp) < CACHE_DURATION) {
      console.log('📦 Serving from cache...', globalJobsCache.length, 'jobs')
      
      // Apply filters to cached data
      let cachedJobs = globalJobsCache
      
      if (search) {
        const searchLower = search.toLowerCase()
        cachedJobs = globalJobsCache.filter(job => 
          job.title.toLowerCase().includes(searchLower) ||
          job.description.toLowerCase().includes(searchLower) ||
          job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
          (job.category && job.category.toLowerCase().includes(searchLower))
        )
      }
      
      if (category) {
        cachedJobs = cachedJobs.filter(job => 
          job.category === category || job.subcategory === category
        )
      }
      
      if (cachedJobs.length > 0) {
        return NextResponse.json({
          success: true,
          jobs: cachedJobs.slice(0, 200), // Limit to 200 for performance
          total: cachedJobs.length,
          message: `✅ ${cachedJobs.length} jobs loaded (from cache${search ? `, search: "${search}"` : ''}${category ? `, category: "${category}"` : ''})`,
          upworkConnected: true,
          cached: true,
          searchApplied: !!search
        })
      }
    }
    
    console.log('🔄 Fetching fresh data from Upwork API...')
    
    // Fetch jobs from Upwork with REAL search
    const result = await fetchAllUpworkJobs(accessToken, search, category, forceRefresh)
    
    if (!result.success) {
      console.error('❌ Failed to fetch jobs:', result.error)
      
      // If cache exists and API fails, return cache
      if (globalJobsCache.length > 0) {
        console.log('⚠️ Using cached data due to API error')
        
        let cachedJobs = globalJobsCache
        if (search) {
          const searchLower = search.toLowerCase()
          cachedJobs = globalJobsCache.filter(job => 
            job.title.toLowerCase().includes(searchLower) ||
            job.description.toLowerCase().includes(searchLower) ||
            job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
          )
        }
        
        return NextResponse.json({
          success: true,
          jobs: cachedJobs.slice(0, 200),
          total: cachedJobs.length,
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
    
    // Update cache (only if not searching by category)
    if (!category) {
      globalJobsCache = result.jobs
      globalCacheTimestamp = now
      console.log(`💾 Updated cache with ${result.jobs.length} jobs`)
    }
    
    // Prepare response message
    let message = ''
    if (search) {
      message = result.jobs.length > 0
        ? `✅ Found ${result.jobs.length} jobs for "${search}"`
        : `❌ No jobs found for "${search}"`
    } else if (category) {
      message = result.jobs.length > 0
        ? `✅ Found ${result.jobs.length} jobs in "${category}"`
        : `❌ No jobs found in "${category}"`
    } else {
      message = result.jobs.length > 0
        ? `✅ Loaded ${result.jobs.length} REAL jobs from Upwork`
        : '❌ No jobs found'
    }
    
    // Return limited jobs for performance (max 200)
    const jobsToReturn = result.jobs.slice(0, 200)
    
    return NextResponse.json({
      success: true,
      jobs: jobsToReturn,
      total: result.total,
      displayed: jobsToReturn.length,
      message: message,
      upworkConnected: true,
      cached: false,
      searchApplied: !!search,
      categoryApplied: !!category
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    
    // Return cache if available
    if (globalJobsCache.length > 0) {
      console.log('⚠️ Returning cached data due to error')
      return NextResponse.json({
        success: true,
        jobs: globalJobsCache.slice(0, 200),
        total: globalJobsCache.length,
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
    const { action } = await request.json()
    
    if (action === 'clear') {
      globalJobsCache = []
      globalCacheTimestamp = 0
      
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