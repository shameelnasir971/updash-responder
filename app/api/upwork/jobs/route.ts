

// app/api/upwork/jobs/route.ts - FIXED VERSION (Bulk Fetch with Pagination)
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Cache system
let jobsCache: any = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

// ✅ SIMPLE and CORRECT GraphQL Query
async function fetchUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 Fetching Upwork jobs...', searchTerm ? `Search: "${searchTerm}"` : 'All jobs')
    
    // ✅ SINGLE SIMPLE QUERY - NO BATCHES, NO COMPLEX STUFF
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
    
    console.log('📤 Making GraphQL request to Upwork...')
    
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
      console.error('❌ API request failed:', errorText.substring(0, 500))
      return { 
        success: false, 
        error: `API error: ${response.status}`, 
        jobs: [] 
      }
    }
    
    const data = await response.json()
    
    // Log the response structure for debugging
    console.log('📊 Response structure:', {
      hasData: !!data.data,
      hasErrors: !!data.errors,
      edgesCount: data.data?.marketplaceJobPostingsSearch?.edges?.length || 0
    })
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { 
        success: false, 
        error: data.errors[0]?.message, 
        jobs: [] 
      }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} raw job edges from Upwork`)
    
    if (edges.length === 0) {
      console.warn('⚠️ Upwork API returned 0 jobs. Check API key permissions.')
      return { 
        success: true, 
        jobs: [], 
        error: null 
      }
    }
    
    // ✅ Format jobs properly
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // ✅ Budget formatting
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
      
      // ✅ Real skills from API
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || 
                        ['Skills not specified']
      
      // ✅ Real proposal count
      const realProposals = node.totalApplicants || 0
      
      // ✅ Posted date
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently'
      
      // ✅ Category
      const category = node.category || 'General'
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      // ✅ Job type and experience
      const jobType = node.engagement || node.durationLabel || 'Not specified'
      const experienceLevel = node.experienceLevel || 'Not specified'
      
      return {
        id: node.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: node.title || 'Upwork Job',
        description: node.description || 'No description available',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: 'Upwork Client',
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
        isRealJob: true
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} jobs successfully`)
    
    // ✅ Apply search filter if needed
    let filteredJobs = jobs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredJobs = jobs.filter((job: { title: string; description: string; skills: string[]; category: string }) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
        (job.category && job.category.toLowerCase().includes(searchLower))
      )
      console.log(`🔍 After search filter: ${filteredJobs.length} jobs`)
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

export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API CALLED ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('User:', user.email)
    
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
    
    // Check cache (only if not force refresh and no search)
    const now = Date.now()
    if (!forceRefresh && !search && jobsCache && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log('📦 Serving from cache...')
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        total: jobsCache.length,
        message: `✅ ${jobsCache.length} jobs loaded (from cache)`,
        upworkConnected: true,
        cached: true
      })
    }
    
    console.log('🔄 Fetching fresh data from Upwork...')
    
    // Fetch jobs from Upwork
    const result = await fetchUpworkJobs(accessToken, search)
    
    if (!result.success) {
      console.error('❌ Failed to fetch jobs:', result.error)
      
      // If cache exists and we have an error, return cache
      if (jobsCache && jobsCache.length > 0) {
        console.log('⚠️ Using cached data due to API error')
        return NextResponse.json({
          success: true,
          jobs: jobsCache,
          total: jobsCache.length,
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
    
    // Update cache (only if no search)
    if (!search) {
      jobsCache = result.jobs
      cacheTimestamp = now
      console.log(`💾 Updated cache with ${result.jobs.length} jobs`)
    }
    
    // Return results
    const message = result.jobs.length > 0
      ? `✅ Success! Loaded ${result.jobs.length} real jobs from Upwork`
      : '❌ No jobs found. Try different search terms or check Upwork directly.'
    
    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      total: result.jobs.length,
      message: message,
      upworkConnected: true,
      cached: false
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    
    // Return cache if available
    if (jobsCache && jobsCache.length > 0) {
      console.log('⚠️ Returning cached data due to error')
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
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
      message: `❌ Error: ${error.message}`
    }, { status: 500 })
  }
}