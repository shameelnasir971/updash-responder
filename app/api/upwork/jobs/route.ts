import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ GLOBAL CACHE WITH PAGINATION
let jobsCache: any[] = []
let allJobsFetched: any[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

// ✅ ADVANCED PAGINATION FUNCTION (Fetch ALL Jobs)
async function fetchAllUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 START: Fetching ALL Upwork jobs with pagination...')
    
    let allJobs: any[] = []
    let hasNextPage = true
    let endCursor: string | null = null
    let pageCount = 0
    const MAX_PAGES = 50 // Safety limit
    
    // ✅ OPTION 1: Server-Side Search if Upwork supports it
    let graphqlQuery: any
    
    if (searchTerm) {
      console.log(`🔍 Server-side search for: "${searchTerm}"`)
      graphqlQuery = {
        query: `
          query SearchJobs($first: Int, $after: String, $search: String) {
            marketplaceJobPostingsSearch(
              first: $first, 
              after: $after,
              filter: { anyKeyword: $search }
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
                  createdDateTime
                  publishedDateTime
                  experienceLevel
                  engagement
                  duration
                  durationLabel
                }
                cursor
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `,
        variables: {
          first: 100, // Get 100 per page
          after: endCursor,
          search: searchTerm
        }
      }
    } else {
      // ✅ OPTION 2: Fetch ALL Jobs without search
      graphqlQuery = {
        query: `
          query GetAllJobs($first: Int, $after: String) {
            marketplaceJobPostingsSearch(first: $first, after: $after) {
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
                cursor
              }
              pageInfo {
                hasNextPage
                endCursor
              }
            }
          }
        `,
        variables: {
          first: 100, // Get 100 per page
          after: endCursor
        }
      }
    }
    
    // ✅ LOOP THROUGH ALL PAGES
    while (hasNextPage && pageCount < MAX_PAGES) {
      try {
        console.log(`📄 Fetching page ${pageCount + 1}...`)
        
        const response = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(graphqlQuery)
        })
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('❌ API page error:', response.status, errorText.substring(0, 200))
          break
        }
        
        const data = await response.json()
        
        if (data.errors) {
          console.error('❌ GraphQL errors:', data.errors)
          break
        }
        
        const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
        const pageInfo = data.data?.marketplaceJobPostingsSearch?.pageInfo
        
        console.log(`✅ Page ${pageCount + 1}: Found ${edges.length} jobs`)
        
        // ✅ Format jobs with 100% REAL DATA
        const jobs = edges.map((edge: any) => {
          const node = edge.node || {}
          
          // REAL BUDGET
          let budgetText = 'Budget not specified'
          if (node.amount?.rawValue) {
            const rawValue = parseFloat(node.amount.rawValue)
            const currency = node.amount.currency || 'USD'
            budgetText = `$${rawValue.toFixed(2)}`
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
          
          // REAL SKILLS
          const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
          
          // REAL DATE (Last 30 days filter)
          const postedDate = node.createdDateTime || node.publishedDateTime
          const jobDate = postedDate ? new Date(postedDate) : new Date()
          const oneMonthAgo = new Date()
          oneMonthAgo.setDate(oneMonthAgo.getDate() - 30)
          
          // Skip if older than 30 days
          if (jobDate < oneMonthAgo) {
            return null
          }
          
          const formattedDate = jobDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          })
          
          // REAL CATEGORY
          const category = node.category || 'General'
          const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
          
          return {
            id: node.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: node.title || '',
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
            skills: realSkills.slice(0, 10),
            proposals: node.totalApplicants || 0,
            verified: true,
            category: cleanedCategory,
            jobType: node.engagement || node.durationLabel || 'Not specified',
            experienceLevel: node.experienceLevel || 'Not specified',
            source: 'upwork',
            isRealJob: true,
            postedTimestamp: jobDate.getTime()
          }
        }).filter(Boolean) // Remove null jobs
        
        allJobs = allJobs.concat(jobs)
        
        hasNextPage = pageInfo?.hasNextPage || false
        endCursor = pageInfo?.endCursor
        
        // Update cursor for next page
        if (graphqlQuery.variables) {
          graphqlQuery.variables.after = endCursor
        }
        
        pageCount++
        
        // Stop if we have enough jobs
        if (searchTerm && allJobs.length >= 50) break
        if (!searchTerm && allJobs.length >= 500) break
        
        // Small delay to avoid rate limiting
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
      } catch (pageError: any) {
        console.error(`❌ Error on page ${pageCount + 1}:`, pageError.message)
        break
      }
    }
    
    console.log(`🎉 FINISHED: Fetched ${allJobs.length} REAL jobs from ${pageCount} pages`)
    
    // ✅ Sort by newest first
    allJobs.sort((a, b) => b.postedTimestamp - a.postedTimestamp)
    
    return { 
      success: true, 
      jobs: allJobs, 
      error: null,
      pagesFetched: pageCount
    }
    
  } catch (error: any) {
    console.error('❌ CRITICAL Fetch error:', error.message)
    return { 
      success: false, 
      error: error.message, 
      jobs: []
    }
  }
}

// ✅ MAIN API ENDPOINT WITH PAGINATION
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API WITH PAGINATION ===')
    
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
    
    // Check cache for ALL jobs (not just 10)
    const now = Date.now()
    const cacheKey = search ? `search_${search}` : 'all'
    
    // If we already have all jobs in cache and not forcing refresh
    if (!forceRefresh && allJobsFetched.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log(`📦 Serving ${allJobsFetched.length} jobs from cache`)
      
      // Apply search filter to cached data
      let filteredJobs = allJobsFetched
      if (search) {
        const searchLower = search.toLowerCase()
        filteredJobs = allJobsFetched.filter(job => 
          job.title.toLowerCase().includes(searchLower) ||
          job.description.toLowerCase().includes(searchLower) ||
          job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
          (job.category && job.category.toLowerCase().includes(searchLower))
        )
      }
      
      return NextResponse.json({
        success: true,
        jobs: filteredJobs.slice(0, 200), // Show first 200 for performance
        total: filteredJobs.length,
        message: `✅ ${filteredJobs.length} real jobs (from cache${search ? `, search: "${search}"` : ''})`,
        upworkConnected: true,
        cached: true,
        totalAvailable: filteredJobs.length
      })
    }
    
    // ✅ FETCH FRESH DATA WITH PAGINATION
    console.log('🔄 Fetching FRESH data with pagination...')
    
    const result = await fetchAllUpworkJobs(accessToken, search)
    
    if (!result.success) {
      console.error('❌ Failed to fetch jobs:', result.error)
      
      // Return cached data if available
      if (allJobsFetched.length > 0) {
        let filteredJobs = allJobsFetched
        if (search) {
          const searchLower = search.toLowerCase()
          filteredJobs = allJobsFetched.filter(job => 
            job.title.toLowerCase().includes(searchLower) ||
            job.description.toLowerCase().includes(searchLower) ||
            job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
          )
        }
        
        return NextResponse.json({
          success: true,
          jobs: filteredJobs.slice(0, 200),
          total: filteredJobs.length,
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
    if (!search) {
      allJobsFetched = result.jobs
      cacheTimestamp = now
      console.log(`💾 Updated cache with ${result.jobs.length} jobs (${result.pagesFetched} pages)`)
    }
    
    // Prepare response
    const displayJobs = result.jobs.slice(0, 200) // Show first 200
    const totalJobs = result.jobs.length
    
    let message = ''
    if (search) {
      message = totalJobs > 0
        ? `✅ Found ${totalJobs} jobs for "${search}" (${result.pagesFetched} pages searched)`
        : `❌ No jobs found for "${search}"`
    } else {
      message = totalJobs > 0
        ? `✅ Loaded ${totalJobs} REAL jobs from Upwork (${result.pagesFetched} pages fetched)`
        : '❌ No jobs found'
    }
    
    return NextResponse.json({
      success: true,
      jobs: displayJobs,
      total: totalJobs,
      message: message,
      upworkConnected: true,
      cached: false,
      pagesFetched: result.pagesFetched,
      totalAvailable: totalJobs
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    
    // Return cache if available
    if (allJobsFetched.length > 0) {
      console.log('⚠️ Returning cached data due to error')
      return NextResponse.json({
        success: true,
        jobs: allJobsFetched.slice(0, 200),
        total: allJobsFetched.length,
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
    allJobsFetched = []
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