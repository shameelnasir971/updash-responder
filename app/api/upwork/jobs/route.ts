import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ SIMPLE, WORKING GRAPHQL QUERY
async function fetchUpworkJobs(accessToken: string, searchTerm?: string) {
  try {
    console.log('🚀 Fetching Upwork jobs...')
    
    // ✅ CORRECT QUERY STRUCTURE - NO INVALID FILTERS
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs($first: Int!) {
          marketplaceJobPostingsSearch(first: $first) {
            edges {
              cursor
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
                client {
                  nid
                  totalSpent
                  totalHires
                }
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
        first: 50 // Fetch 50 jobs per request
      }
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upwork-API-TenantId': 'api',
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API request failed:', response.status, errorText.substring(0, 200))
      return { 
        success: false, 
        error: `API error: ${response.status}`, 
        jobs: []
      }
    }
    
    const data = await response.json()
    
    // ✅ CRITICAL: Check for GraphQL errors in response [citation:5]
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { 
        success: false, 
        error: data.errors[0]?.message || 'GraphQL query error', 
        jobs: []
      }
    }
    
    console.log('📊 GraphQL response structure:', {
      hasData: !!data.data,
      hasSearch: !!data.data?.marketplaceJobPostingsSearch,
      edgesCount: data.data?.marketplaceJobPostingsSearch?.edges?.length || 0
    })
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} raw job edges`)
    
    if (edges.length === 0) {
      return { success: true, jobs: [], error: null }
    }
    
    // ✅ Format jobs with REAL data
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // Format budget
      let budgetText = 'Budget not specified'
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        budgetText = currency === 'USD' ? `$${rawValue.toFixed(2)}` : `${rawValue.toFixed(2)} ${currency}`
      } else if (node.hourlyBudgetMin?.rawValue) {
        const minVal = parseFloat(node.hourlyBudgetMin.rawValue)
        const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal
        const currency = node.hourlyBudgetMin?.currency || 'USD'
        const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency + ' '
        budgetText = minVal === maxVal ? `${symbol}${minVal.toFixed(2)}/hr` : `${symbol}${minVal.toFixed(2)}-${maxVal.toFixed(2)}/hr`
      }
      
      // Format skills
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // Format date
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? new Date(postedDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      }) : 'Recently'
      
      return {
        id: node.id,
        title: node.title || 'Job',
        description: node.description || '',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: 'Client',
          rating: 4.0,
          country: 'Remote',
          totalSpent: node.client?.totalSpent || 0,
          totalHires: node.client?.totalHires || 0
        },
        skills: realSkills.slice(0, 5),
        proposals: node.totalApplicants || 0,
        verified: true,
        category: node.category || 'General',
        jobType: node.engagement || node.durationLabel || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
    // ✅ Apply search filter CLIENT-SIDE
    let filteredJobs = jobs
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      filteredJobs = jobs.filter((job: { title: string; description: string; skills: any[] }) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
      )
    }
    
    return { success: true, jobs: filteredJobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// ✅ REMOVE CACHE - IT'S CAUSING EMPTY RESPONSES
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API CALLED (NO CACHE) ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    
    console.log('User:', user.email, 'Search:', search || 'none')
    
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
    
    // ✅ ALWAYS FETCH FRESH DATA - NO CACHE
    const result = await fetchUpworkJobs(accessToken, search)
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: `❌ API Error: ${result.error}`,
        upworkConnected: true
      })
    }
    
    // Prepare message
    let message = ''
    if (search) {
      message = result.jobs.length > 0
        ? `✅ Found ${result.jobs.length} jobs for "${search}"`
        : `❌ No jobs found for "${search}"`
    } else {
      message = result.jobs.length > 0
        ? `✅ Loaded ${result.jobs.length} real jobs from Upwork`
        : '❌ No jobs available at the moment'
    }
    
    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      total: result.jobs.length,
      message: message,
      upworkConnected: true,
      cached: false
    })
    
  } catch (error: any) {
    console.error('❌ Server error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: `❌ Server error: ${error.message}`
    }, { status: 500 })
  }
}