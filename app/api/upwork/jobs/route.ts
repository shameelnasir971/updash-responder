// app/api/upwork/jobs/route.ts 
// app/api/upwork/jobs/route.ts - FIXED VERSION (SERVER-SIDE FILTERING)
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Helper: Format currency
function formatCurrency(value: number, currency: string): string {
  const symbols: { [key: string]: string } = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'AUD': 'A$', 'CAD': 'C$'
  }
  const symbol = symbols[currency] || currency + ' '
  return `${symbol}${value.toFixed(2)}`
}

// ✅ Helper: Format hourly rate
function formatHourlyRate(min: number, max: number, currency: string): string {
  const symbols: { [key: string]: string } = {
    'USD': '$', 'EUR': '€', 'GBP': '£', 'INR': '₹', 'AUD': 'A$', 'CAD': 'C$'
  }
  const symbol = symbols[currency] || currency + ' '
  if (min === max || max === 0) {
    return `${symbol}${min.toFixed(2)}/hr`
  } else {
    return `${symbol}${min.toFixed(2)}-${max.toFixed(2)}/hr`
  }
}

// ✅ Helper: Server-side search filter
function filterJobsBySearch(jobs: any[], searchQuery: string): any[] {
  if (!searchQuery.trim()) return jobs
  
  const query = searchQuery.toLowerCase().trim()
  
  return jobs.filter(job => {
    // Search in title
    if (job.title?.toLowerCase().includes(query)) return true
    
    // Search in description
    if (job.description?.toLowerCase().includes(query)) return true
    
    // Search in skills
    if (job.skills?.some((skill: string) => skill.toLowerCase().includes(query))) return true
    
    // Search in category
    if (job.category?.toLowerCase().includes(query)) return true
    
    return false
  })
}

// ✅ MAIN FUNCTION: Fetch jobs from Upwork WITHOUT GraphQL filter
async function fetchUpworkJobs(accessToken: string, limit: number = 100) {
  try {
    console.log(`🚀 Fetching ${limit} jobs from Upwork...`)
    
    // ✅ SIMPLE GraphQL query WITHOUT filter (jo kaam karta hai)
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs($first: Int) {
          marketplaceJobPostingsSearch(first: $first) {
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
            totalCount
          }
        }
      `,
      variables: {
        first: limit
      }
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
      const error = await response.text()
      console.error('API error:', error.substring(0, 300))
      return { success: false, error: 'API request failed', jobs: [] }
    }
    
    const data = await response.json()
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    const totalCount = data.data?.marketplaceJobPostingsSearch?.totalCount || 0
    
    console.log(`✅ Successfully fetched ${edges.length} jobs from Upwork API`)
    
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
      } else if (node.amount?.displayValue) {
        budgetText = node.amount.displayValue
      }
      
      // Real skills
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || 
                        ['Skills not specified']
      
      // Real posted date
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
        // Neutral client data
        client: {
          name: 'Upwork Client',
          rating: 0,
          country: 'Not specified',
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
        isRealJob: true
      }
    })
    
    return { 
      success: true, 
      jobs: jobs, 
      error: null,
      totalCount: totalCount
    }
    
  } catch (error: any) {
    console.error('Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// ✅ GET endpoint with SERVER-SIDE search
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API: SERVER-SIDE SEARCH ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const limit = parseInt(searchParams.get('limit') || '100')
    
    console.log('📋 Request params:', { search, limit, user: user.email })
    
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
    
    // Step 1: Fetch all jobs from Upwork
    const result = await fetchUpworkJobs(accessToken, limit)
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: result.error || 'Failed to fetch jobs',
        upworkConnected: true
      })
    }
    
    // Step 2: Apply server-side search filter
    let filteredJobs = result.jobs
    let searchMessage = ''
    
    if (search) {
      const originalCount = filteredJobs.length
      filteredJobs = filterJobsBySearch(filteredJobs, search)
      searchMessage = ` (${filteredJobs.length} match "${search}")`
    }
    
    console.log(`🔍 Search results: ${filteredJobs.length} jobs${search ? ` for "${search}"` : ''}`)
    
    return NextResponse.json({
      success: true,
      jobs: filteredJobs,
      total: filteredJobs.length,
      totalAvailable: result.totalCount || 0,
      message: `✅ ${filteredJobs.length} jobs loaded${searchMessage}`,
      upworkConnected: true,
      searchQuery: search || null,
      searchApplied: !!search
    })
    
  } catch (error: any) {
    console.error('Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message
    }, { status: 500 })
  }
}