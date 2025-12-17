import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Cache (simple in-memory)
let jobsCache: any[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Updated fetch function with pagination, recency sort, and proper search
async function fetchUpworkJobs(accessToken: string, searchTerm?: string, cursor?: string) {
  try {
    console.log('Fetching Upwork jobs...', { searchTerm, cursor })

    // Proper GraphQL query with pagination and recency sort
    const graphqlQuery = {
      query: `
        query MarketplaceJobPostingsSearch($filter: MarketplaceJobPostingsSearchFilter, $after: String) {
          marketplaceJobPostingsSearch(
            marketPlaceJobFilter: $filter
            searchType: USER_JOBS_SEARCH
          ) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              cursor
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
                durationLabel
              }
            }
          }
        }
      `,
      variables: {
        filter: {
          // Recency sort (newest first)
          sortedBy: { field: "RECENCY", direction: "DESC" },
          // Search filter (if provided)
          ...(searchTerm && {
            query: searchTerm // Free text search in title/description/skills
            // OR more precise:
            // titleExpression_eq: searchTerm,
            // searchTerm_eq: { andTerms_all: [searchTerm] }
          }),
          pagination_eq: {
            first: 50, // Max practical limit
            ...(cursor && { after: cursor })
          }
        },
        after: cursor || null
      }
    }

    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        // Optional: Tenant ID if needed (from your callback)
        // 'X-Upwork-API-TenantId': tenantId
      },
      body: JSON.stringify(graphqlQuery)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('API error:', response.status, errorText)
      return { success: false, jobs: [], message: `API error: ${response.status}` }
    }

    const data = await response.json()

    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      return { success: false, jobs: [], message: data.errors[0]?.message || 'GraphQL error' }
    }

    const searchResult = data.data?.marketplaceJobPostingsSearch
    const edges = searchResult?.edges || []
    const pageInfo = searchResult?.pageInfo || {}

    console.log(`Fetched ${edges.length} jobs | Has next: ${pageInfo.hasNextPage} | Total: ${searchResult.totalCount || 'unknown'}`)

    // Format jobs (same as your previous code - 100% real)
    const jobs = edges.map((edge: any) => {
      const node = edge.node
      // ... (tumhara existing formatting code yahan paste kar do - budget, skills, date etc.)
      // Main ne shorten kiya hay example ke liye

      let budgetText = 'Not specified'
      if (node.amount?.rawValue) {
        budgetText = `${node.amount.displayValue || node.amount.rawValue}`
      } else if (node.hourlyBudgetMin?.rawValue) {
        budgetText = `${node.hourlyBudgetMin.displayValue} - ${node.hourlyBudgetMax?.displayValue || ''}/hr`
      }

      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? new Date(postedDate).toLocaleDateString() : 'Recent'

      return {
        id: node.id,
        title: node.title || 'Untitled Job',
        description: node.description || '',
        budget: budgetText,
        postedDate: formattedDate,
        skills: node.skills?.map((s: any) => s.name) || [],
        proposals: node.totalApplicants || 0,
        category: node.category || 'General',
        source: 'upwork',
        isRealJob: true
      }
    })

    return {
      success: true,
      jobs,
      hasNextPage: pageInfo.hasNextPage,
      endCursor: pageInfo.endCursor,
      totalCount: searchResult.totalCount
    }

  } catch (error: any) {
    console.error('Fetch error:', error)
    return { success: false, jobs: [], message: error.message }
  }
}

// GET endpoint - now supports multiple pages
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const cursor = searchParams.get('cursor') || '' // For load more
    const forceRefresh = searchParams.get('refresh') === 'true'

    const upworkResult = await pool.query('SELECT access_token FROM upwork_accounts WHERE user_id = $1', [user.id])
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Connect Upwork account first', upworkConnected: false })
    }

    const accessToken = upworkResult.rows[0].access_token

    // Fetch (with pagination)
    let allJobs: any[] = []
    let currentCursor: string | null = cursor || null
    let hasNext = true

    while (hasNext && allJobs.length < 300) { // Safety limit - max 300 jobs
      const result = await fetchUpworkJobs(accessToken, search || undefined, currentCursor || undefined)
      
      if (!result.success) {
        return NextResponse.json({ success: false, message: result.message })
      }

      allJobs = [...allJobs, ...result.jobs]
      hasNext = result.hasNextPage
      currentCursor = result.endCursor || null

      // Stop if no more pages
      if (!currentCursor) hasNext = false
    }

    // Update cache if no search
    if (!search && !cursor) {
      jobsCache = allJobs
      cacheTimestamp = Date.now()
    }

    return NextResponse.json({
      success: true,
      jobs: allJobs,
      total: allJobs.length,
      message: `Loaded ${allJobs.length} recent real jobs${search ? ` for "${search}"` : ''}`,
      upworkConnected: true
    })

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}