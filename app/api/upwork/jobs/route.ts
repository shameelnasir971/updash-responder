import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Cache
let jobsCache: any[] = []
let cacheTimestamp: number = 0
let currentCursor: string | null = null
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

async function fetchUpworkJobs(accessToken: string, searchTerm?: string, afterCursor?: string | null) {
  try {
    console.log('🚀 Fetching Upwork jobs...', { searchTerm, afterCursor })

    // Proper GraphQL query with variables
    const variables: any = {
      searchType: "USER_JOBS_SEARCH",
      sortAttributes: [{ field: "RECENCY" }],
      pagination_eq: {
        first: 50, // Try 50-100 (max safe)
        after: afterCursor || null
      }
    }

    // Add search filter if term provided
    if (searchTerm && searchTerm.trim()) {
      variables.marketPlaceJobFilter = {
        searchExpression_eq: searchTerm.trim()
        // Ya titleExpression_eq: searchTerm
        // Ya skillExpression_eq: searchTerm
      }
    }

    const graphqlQuery = {
      query: `
        query MarketplaceJobPostingsSearch(
          $marketPlaceJobFilter: MarketplaceJobPostingsSearchFilter
          $searchType: MarketplaceJobPostingSearchType!
          $sortAttributes: [MarketplaceJobPostingSearchSortAttribute!]
          $pagination_eq: Pagination
        ) {
          marketplaceJobPostingsSearch(
            marketPlaceJobFilter: $marketPlaceJobFilter
            searchType: $searchType
            sortAttributes: $sortAttributes
            pagination_eq: $pagination_eq
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
                hourlyBudgetMin { rawValue currency }
                hourlyBudgetMax { rawValue currency }
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
      variables
    }

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
      console.error('API error:', errorText)
      return { success: false, jobs: [], hasNext: false, endCursor: null, message: `API error ${response.status}` }
    }

    const data = await response.json()

    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      return { success: false, jobs: [], hasNext: false, endCursor: null, message: data.errors[0].message }
    }

    const connection = data.data?.marketplaceJobPostingsSearch
    if (!connection) {
      return { success: false, jobs: [], hasNext: false, endCursor: null, message: 'No data' }
    }

    const edges = connection.edges || []
    const jobs = edges.map((edge: any) => {
      const node = edge.node
      // Same formatting as before (budget, date, etc.)
      let budgetText = 'Not specified'
      if (node.amount?.rawValue) {
        budgetText = `$${parseFloat(node.amount.rawValue).toFixed(2)}`
      } else if (node.hourlyBudgetMin?.rawValue) {
        const min = parseFloat(node.hourlyBudgetMin.rawValue)
        const max = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : min
        budgetText = `$${min.toFixed(2)}-${max.toFixed(2)}/hr`
      }

      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? new Date(postedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Recent'

      const skills = node.skills?.map((s: any) => s.name) || []

      return {
        id: node.id,
        title: node.title || 'Untitled',
        description: node.description || '',
        budget: budgetText,
        postedDate: formattedDate,
        skills: skills.slice(0, 15),
        proposals: node.totalApplicants || 0,
        category: node.category || 'General',
        source: 'upwork',
        isRealJob: true
      }
    })

    return {
      success: true,
      jobs,
      hasNext: connection.pageInfo.hasNextPage,
      endCursor: connection.pageInfo.endCursor,
      totalCount: connection.totalCount || jobs.length,
      message: `Loaded ${jobs.length} jobs${searchTerm ? ` for "${searchTerm}"` : ''}`
    }

  } catch (error: any) {
    console.error('Fetch error:', error)
    return { success: false, jobs: [], hasNext: false, endCursor: null, message: error.message }
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const after = searchParams.get('after') || null
    const forceRefresh = searchParams.get('refresh') === 'true'

    const upworkResult = await pool.query('SELECT access_token FROM upwork_accounts WHERE user_id = $1', [user.id])
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Connect Upwork first', upworkConnected: false })
    }

    const accessToken = upworkResult.rows[0].access_token

    // Cache logic (per search term)
    const cacheKey = search ? `search_${search}` : 'all'
    const now = Date.now()

    if (!forceRefresh && jobsCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION && currentCursor === after && cacheKey === (search ? `search_${search}` : 'all')) {
      // Return cached if same page
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        hasNext: false, // or track per page
        cached: true,
        upworkConnected: true
      })
    }

    const result = await fetchUpworkJobs(accessToken, search, after)

    if (result.success) {
      // Update cache only for first page
      if (!after) {
        jobsCache = result.jobs
        cacheTimestamp = now
      }
      currentCursor = result.endCursor

      return NextResponse.json({
        ...result,
        upworkConnected: true,
        cached: false
      })
    }

    return NextResponse.json(result)

  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 })
  }
}