// app/api/upwork/jobs/route.ts - FIXED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Cache system
let jobsCache: any[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 10 * 60 * 1000 // 10 minutes

async function fetchUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 Fetching Upwork jobs...', searchTerm ? `Search: "${searchTerm}"` : 'All jobs')
    
    // ✅ CORRECT GraphQL Query - NO 'first' parameter
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
    
    console.log('📤 Making GraphQL request...')
    
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
      console.error('❌ API error:', errorText.substring(0, 300))
      return { 
        success: false, 
        error: `API error: ${response.status}`, 
        jobs: [] 
      }
    }
    
    const data = await response.json()
    
    // Debug: Check response
    console.log('📊 Response keys:', Object.keys(data))
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { 
        success: false, 
        error: data.errors[0]?.message, 
        jobs: [] 
      }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges from Upwork`)
    
    if (edges.length === 0) {
      console.warn('⚠️ Upwork API returned 0 jobs')
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
        const dispVal = node.amount.displayValue
        if (dispVal.includes('$') || dispVal.includes('€') || dispVal.includes('£')) {
          budgetText = dispVal
        } else if (!isNaN(parseFloat(dispVal))) {
          budgetText = `$${parseFloat(dispVal).toFixed(2)}`
        }
      }
      
      // Real skills
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // Real proposal count
      const realProposals = node.totalApplicants || 0
      
      // Posted date
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently'
      
      // Category
      const category = node.category || 'General'
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      // Job type
      const jobType = node.engagement || node.durationLabel || 'Not specified'
      const experienceLevel = node.experienceLevel || 'Not specified'
      
      return {
        id: node.id,
        title: node.title || 'Upwork Job',
        description: node.description || 'No description',
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
        jobType: jobType,
        experienceLevel: experienceLevel,
        source: 'upwork',
        isRealJob: true
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} jobs`)
    
    // Search filter
    let filteredJobs = jobs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredJobs = jobs.filter((job: { title: string; description: string; skills: string[]; category: string }) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower)) ||
        (job.category && job.category.toLowerCase().includes(searchLower))
      )
      console.log(`🔍 After search: ${filteredJobs.length} jobs`)
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
    console.log('=== JOBS API ===')
    
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
      console.log('❌ No Upwork connection')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Check cache
    const now = Date.now()
    if (!forceRefresh && !search && jobsCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
      console.log(`📦 Serving ${jobsCache.length} jobs from cache`)
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        total: jobsCache.length,
        message: `✅ ${jobsCache.length} jobs (cached)`,
        upworkConnected: true,
        cached: true
      })
    }
    
    console.log('🔄 Fetching fresh data...')
    
    // Fetch jobs
    const result = await fetchUpworkJobs(accessToken, search)
    
    if (!result.success) {
      console.error('❌ Failed:', result.error)
      
      // Return cache if available
      if (jobsCache.length > 0) {
        console.log('⚠️ Using cached data')
        return NextResponse.json({
          success: true,
          jobs: jobsCache,
          total: jobsCache.length,
          message: `⚠️ Using cached data (API error)`,
          upworkConnected: true,
          cached: true
        })
      }
      
      return NextResponse.json({
        success: false,
        jobs: [],
        message: `❌ API error: ${result.error}`,
        upworkConnected: true
      })
    }
    
    // Update cache
    if (!search) {
      jobsCache = result.jobs
      cacheTimestamp = now
      console.log(`💾 Cache updated: ${result.jobs.length} jobs`)
    }
    
    const message = result.jobs.length > 0
      ? `✅ Loaded ${result.jobs.length} REAL jobs from Upwork`
      : search
        ? `❌ No jobs for "${search}"`
        : '❌ No jobs found'
    
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
    
    if (jobsCache.length > 0) {
      console.log('⚠️ Returning cached data')
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        total: jobsCache.length,
        message: `⚠️ Using cached data`,
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