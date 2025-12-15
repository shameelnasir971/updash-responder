// app/api/upwork/jobs/route.ts 
// app/api/upwork/jobs/route.ts - COMPLETE UPDATED VERSION
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

// ✅ MAIN FUNCTION: Fetch jobs from Upwork with search
async function fetchUpworkJobs(accessToken: string, searchQuery: string = '', limit: number = 100) {
  try {
    console.log(`🚀 Fetching ${limit} jobs${searchQuery ? ` for: "${searchQuery}"` : ''}`)
    
    // ✅ GraphQL query with variables for pagination and search
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs($first: Int, $filter: MarketplaceJobPostingSearchFilterInput) {
          marketplaceJobPostingsSearch(first: $first, filter: $filter) {
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
        first: limit,
        filter: searchQuery ? {
          or: [
            { title: { contains: searchQuery } },
            { description: { contains: searchQuery } },
            { skills: { some: { name: { contains: searchQuery } } } }
          ]
        } : null
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
    
    // Debug response
    if (data.data?.marketplaceJobPostingsSearch?.edges?.[0]?.node) {
      console.log('🔍 First job title:', data.data.marketplaceJobPostingsSearch.edges[0].node.title)
    }
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      // Try simpler query without filter if filter fails
      if (searchQuery) {
        console.log('⚠️ Filter failed, trying without filter...')
        return fetchUpworkJobs(accessToken, '', limit)
      }
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    const totalCount = data.data?.marketplaceJobPostingsSearch?.totalCount || 0
    console.log(`✅ Found ${edges.length} jobs (Total available: ${totalCount})`)
    
    // ✅ Format jobs with REAL data only
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
        // ✅ NEUTRAL CLIENT DATA - NO FAKE NAMES
        client: {
          name: 'Upwork Client',
          rating: 0,
          country: 'Not specified',
          totalSpent: 0,
          totalHires: 0
        },
        skills: realSkills.slice(0, 10), // Show up to 10 skills
        proposals: node.totalApplicants || 0,
        verified: true,
        category: cleanedCategory,
        jobType: node.engagement || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} jobs`)
    
    return { 
      success: true, 
      jobs: jobs, 
      error: null,
      totalCount: totalCount,
      hasMore: data.data?.marketplaceJobPostingsSearch?.pageInfo?.hasNextPage || false
    }
    
  } catch (error: any) {
    console.error('Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// ✅ GET endpoint with search and limit
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API: WITH SEARCH & 100+ JOBS ===')
    
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
    const result = await fetchUpworkJobs(accessToken, search, limit)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      totalAvailable: result.totalCount || 0,
      hasMore: result.hasMore || false,
      message: result.success ? 
        `✅ ${result.jobs.length} jobs loaded${search ? ` for "${search}"` : ''}` : 
        `Error: ${result.error}`,
      upworkConnected: true,
      searchQuery: search || null
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