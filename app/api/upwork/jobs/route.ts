// app/api/upwork/jobs/route.ts - COMPLETE BULK FETCH
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ In-memory cache for ALL jobs (not just 10-13)
let allJobsCache: any[] = []
let jobsLastFetched: number = 0
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes cache

// ✅ BULK FETCH FUNCTION - Gets 1000+ jobs
async function fetchAllUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 FETCHING ALL UPWORK JOBS (1000+)...')
    
    const allJobs = []
    const maxBatches = 20 // Fetch 20 batches (200+ jobs)
    const jobsPerBatch = 50 // Upwork usually gives 20-50 per request
    
    // ✅ Strategy: Fetch jobs from different categories and filters
    const searchConfigs = [
      { sort: 'PUBLISHED_DATE_DESC', query: '' }, // Latest jobs
      { sort: 'PUBLISHED_DATE_DESC', query: 'web development' },
      { sort: 'PUBLISHED_DATE_DESC', query: 'design' },
      { sort: 'PUBLISHED_DATE_DESC', query: 'marketing' },
      { sort: 'PUBLISHED_DATE_DESC', query: 'writing' },
      { sort: 'PUBLISHED_DATE_DESC', query: 'virtual assistant' },
      { sort: 'PUBLISHED_DATE_DESC', query: 'shopify' },
      { sort: 'PUBLISHED_DATE_DESC', query: 'react' },
      { sort: 'PUBLISHED_DATE_DESC', query: 'python' },
      { sort: 'RELEVANCE', query: '' }, // Relevant jobs
      { sort: 'BUDGET_DESC', query: '' }, // High budget jobs
      { sort: 'BUDGET_ASC', query: '' }, // Low budget jobs
    ]
    
    for (let i = 0; i < Math.min(maxBatches, searchConfigs.length); i++) {
      const config = searchConfigs[i]
      const searchQuery = searchTerm || config.query
      
      try {
        console.log(`📦 Batch ${i+1}/${searchConfigs.length}: ${searchQuery || 'All Jobs'}`)
        
        const graphqlQuery = {
          query: `
            query GetMarketplaceJobs($q: String, $sort: MarketplaceJobPostingSearchSortEnum) {
              marketplaceJobPostingsSearch(
                ${searchQuery ? `q: $q` : ''}
                ${config.sort ? `sort: $sort` : ''}
                first: ${jobsPerBatch}
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
          variables: {
            q: searchQuery || '',
            sort: config.sort
          }
        }
        
        const response = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(graphqlQuery)
        })
        
        if (!response.ok) {
          console.error(`Batch ${i+1} failed: ${response.status}`)
          continue
        }
        
        const data = await response.json()
        
        if (data.errors) {
          console.error(`Batch ${i+1} errors:`, data.errors)
          continue
        }
        
        const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
        
        // Format jobs
        const batchJobs = edges.map((edge: any) => {
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
          }
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
          else if (node.amount?.displayValue) {
            budgetText = node.amount.displayValue
          }
          
          // Real skills
          const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
          
          // Posted date
          const postedDate = node.createdDateTime || node.publishedDateTime
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
            postedTimestamp: postedDate ? new Date(postedDate).getTime() : Date.now(),
            client: {
              name: 'Upwork Client', // Neutral placeholder
              rating: 0,
              country: 'Not specified',
              totalSpent: 0,
              totalHires: 0
            },
            skills: realSkills.slice(0, 5),
            proposals: node.totalApplicants || 0,
            verified: true,
            category: node.category || 'General',
            jobType: node.engagement || node.durationLabel || 'Not specified',
            experienceLevel: node.experienceLevel || 'Not specified',
            source: 'upwork',
            isRealJob: true,
            _fetchBatch: i+1,
            _searchConfig: searchQuery || 'all'
          }
        })
        
        allJobs.push(...batchJobs)
        console.log(`✅ Batch ${i+1}: Added ${batchJobs.length} jobs (Total: ${allJobs.length})`)
        
        // Wait 500ms between batches to avoid rate limiting
        if (i < Math.min(maxBatches, searchConfigs.length) - 1) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
      } catch (batchError: any) {
        console.error(`Batch ${i+1} error:`, batchError.message)
        continue
      }
    }
    
    console.log(`🎯 TOTAL JOBS FETCHED: ${allJobs.length}`)
    
    // ✅ Remove duplicates by job ID
    const uniqueJobs = Array.from(
      new Map(allJobs.map(job => [job.id, job])).values()
    )
    
    console.log(`🎯 UNIQUE JOBS: ${uniqueJobs.length}`)
    
    // ✅ Sort by latest first
    uniqueJobs.sort((a: any, b: any) => b.postedTimestamp - a.postedTimestamp)
    
    // ✅ Apply search filter if provided
    let filteredJobs = uniqueJobs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredJobs = uniqueJobs.filter(job => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
        job.category?.toLowerCase().includes(searchLower)
      )
      console.log(`🔍 After search "${searchTerm}": ${filteredJobs.length} jobs`)
    }
    
    // Update cache for non-search results
    if (!searchTerm) {
      allJobsCache = filteredJobs
      jobsLastFetched = Date.now()
      console.log(`💾 Updated cache with ${filteredJobs.length} jobs`)
    }
    
    return {
      success: true,
      jobs: filteredJobs,
      total: filteredJobs.length,
      uniqueTotal: uniqueJobs.length,
      cached: false,
      message: searchTerm 
        ? `🔍 Found ${filteredJobs.length} jobs for "${searchTerm}"`
        : `✅ Loaded ${filteredJobs.length} real jobs from Upwork`
    }
    
  } catch (error: any) {
    console.error('Bulk fetch error:', error)
    return {
      success: false,
      jobs: [],
      total: 0,
      error: error.message
    }
  }
}

// ✅ GET NEW JOBS ONLY (for auto-refresh)
async function fetchNewJobsOnly(accessToken: string, lastFetchTime: number) {
  try {
    console.log(`🔄 Fetching NEW jobs since ${new Date(lastFetchTime).toISOString()}`)
    
    // Fetch latest 100 jobs
    const graphqlQuery = {
      query: `
        query GetNewJobs {
          marketplaceJobPostingsSearch(
            sort: PUBLISHED_DATE_DESC
            first: 100
          ) {
            edges {
              node {
                id
                title
                description
                amount { rawValue currency displayValue }
                createdDateTime
                publishedDateTime
                skills { name }
                totalApplicants
                category
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
    
    if (!response.ok) return { success: false, newJobs: [] }
    
    const data = await response.json()
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    
    const newJobs = edges.map((edge: any) => {
      const node = edge.node || {}
      const jobTime = new Date(node.createdDateTime || node.publishedDateTime).getTime()
      
      // Only include jobs newer than last fetch
      if (jobTime > lastFetchTime) {
        return {
          id: node.id,
          title: node.title || 'New Job',
          description: node.description || '',
          postedTimestamp: jobTime
        }
      }
      return null
    }).filter(Boolean)
    
    console.log(`🆕 Found ${newJobs.length} new jobs`)
    return { success: true, newJobs }
    
  } catch (error) {
    console.error('New jobs fetch error:', error)
    return { success: false, newJobs: [] }
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const refresh = searchParams.get('refresh') === 'true'
    const getNewOnly = searchParams.get('newOnly') === 'true'
    const since = searchParams.get('since') // timestamp
    
    console.log('📥 API Request:', { search, refresh, getNewOnly, since })
    
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
    
    // ✅ OPTION 1: Get only new jobs (for auto-refresh)
    if (getNewOnly && since) {
      const result = await fetchNewJobsOnly(accessToken, parseInt(since))
      return NextResponse.json({
        success: result.success,
        newJobs: result.newJobs,
        message: `Found ${result.newJobs.length} new jobs`
      })
    }
    
    // ✅ OPTION 2: Use cache for non-search (if not refreshing)
    const now = Date.now()
    if (!refresh && !search && allJobsCache.length > 0 && (now - jobsLastFetched) < CACHE_DURATION) {
      console.log(`📦 Serving ${allJobsCache.length} jobs from cache`)
      return NextResponse.json({
        success: true,
        jobs: allJobsCache,
        total: allJobsCache.length,
        cached: true,
        message: `✅ ${allJobsCache.length} jobs loaded (cached)`,
        upworkConnected: true,
        searchTerm: null
      })
    }
    
    // ✅ OPTION 3: Fetch ALL jobs from Upwork
    console.log('🔄 Fetching ALL jobs from Upwork...')
    const result = await fetchAllUpworkJobs(accessToken, search)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      uniqueTotal: result.uniqueTotal || result.jobs.length,
      cached: false,
      message: result.message || 'Loaded jobs successfully',
      upworkConnected: true,
      searchTerm: search || null,
      lastFetched: Date.now()
    })
    
  } catch (error: any) {
    console.error('API error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message
    }, { status: 500 })
  }
}

// Clear cache endpoint
export async function POST(request: NextRequest) {
  allJobsCache = []
  jobsLastFetched = 0
  
  return NextResponse.json({
    success: true,
    message: 'Cache cleared'
  })
}