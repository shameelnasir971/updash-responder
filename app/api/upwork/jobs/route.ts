import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Cache for 5 minutes
let jobsCache: any[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

async function fetchUpworkJobs(accessToken: string, searchTerm?: string, afterCursor?: string) {
  try {
    console.log('🚀 Fetching Upwork jobs...', searchTerm ? `Keyword: "${searchTerm}"` : 'All recent jobs')

    const variables: any = {
      searchType: "USER_JOBS_SEARCH",
      sortAttributes: [
        { field: "RECENCY", direction: "DESC" } // Newest jobs first
      ],
      pagination: {
        first: 50 // Max per page
      }
    }

    // Minimal filter – empty for all recent jobs
    variables.marketPlaceJobFilter = {}

    // Add keyword search if provided
    if (searchTerm) {
      variables.marketPlaceJobFilter.q = searchTerm
    }

    // Pagination cursor
    if (afterCursor) {
      variables.pagination.after = afterCursor
    }

    const graphqlQuery = {
      query: `
        query MarketplaceJobPostingsSearch(
          $marketPlaceJobFilter: MarketplaceJobPostingsSearchFilter
          $searchType: MarketplaceJobPostingSearchType!
          $sortAttributes: [MarketplaceJobPostingSearchSortAttribute!]
          $pagination: ConnectionPagination
        ) {
          marketplaceJobPostingsSearch(
            marketPlaceJobFilter: $marketPlaceJobFilter
            searchType: $searchType
            sortAttributes: $sortAttributes
            pagination: $pagination
          ) {
            totalCount
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                description
                amount {
                  rawValue
                  currency
                }
                hourlyBudgetMin {
                  rawValue
                  currency
                }
                hourlyBudgetMax {
                  rawValue
                  currency
                }
                skills {
                  name
                  prettyName
                }
                totalApplicants
                category
                publishedDateTime
                createdDateTime
                experienceLevel
                engagement
                durationLabel
                client {
                  feedbackScore
                  totalHires
                  country
                  verifiedPayment
                }
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
      console.error('❌ API error:', response.status, errorText.substring(0, 500))
      return { success: false, jobs: [], hasNextPage: false, endCursor: null }
    }

    const data = await response.json()

    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { success: false, jobs: [], hasNextPage: false, endCursor: null }
    }

    const connection = data.data?.marketplaceJobPostingsSearch
    const edges = connection?.edges || []
    const pageInfo = connection?.pageInfo || {}

    console.log(`✅ Fetched ${edges.length} jobs this page, hasNext: ${pageInfo.hasNextPage}`)

    const jobs = edges.map((edge: any) => {
      const node = edge.node

      let budgetText = 'Not specified'
      if (node.amount?.rawValue) {
        budgetText = `$${parseFloat(node.amount.rawValue).toFixed(0)} Fixed`
      } else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
        const min = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : null
        const max = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : null
        if (min && max && min !== max) {
          budgetText = `$${min}-${max}/hr`
        } else if (min || max) {
          budgetText = `$${min || max}/hr`
        }
      }

      const postedDate = node.publishedDateTime || node.createdDateTime || new Date().toISOString()
      const formattedDate = new Date(postedDate).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })

      const skills = node.skills?.map((s: any) => s.prettyName || s.name) || []

      const client = node.client || {}

      return {
        id: node.id,
        title: node.title || 'Untitled',
        description: node.description || '',
        budget: budgetText,
        postedDate: formattedDate + ' ago',
        client: {
          name: 'Client',
          rating: client.feedbackScore || 0,
          country: client.country || 'Worldwide',
          totalSpent: 0,
          totalHires: client.totalHires || 0,
          verified: client.verifiedPayment || false
        },
        skills: skills.slice(0, 12),
        proposals: node.totalApplicants || 0,
        verified: true,
        category: node.category || 'General',
        jobType: node.engagement || node.durationLabel || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })

    return {
      success: true,
      jobs,
      hasNextPage: pageInfo.hasNextPage || false,
      endCursor: pageInfo.endCursor
    }

  } catch (error: any) {
    console.error('❌ Fetch error:', error)
    return { success: false, jobs: [], hasNextPage: false, endCursor: null }
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
    const forceRefresh = searchParams.get('refresh') === 'true'

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

    const now = Date.now()
    if (!forceRefresh && !search && jobsCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION) {
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        message: `✅ ${jobsCache.length} recent jobs (cached)`,
        upworkConnected: true,
        cached: true
      })
    }

    // Fetch all pages
    let allJobs: any[] = []
    let cursor: string | null = null
    let hasNext = true
    let pages = 0

    while (hasNext && pages < 20) { // Max 20 pages safety (~1000 jobs)
      const result = await fetchUpworkJobs(accessToken, search || undefined, cursor || undefined)

      if (!result.success || result.jobs.length === 0) {
        break
      }

      allJobs = allJobs.concat(result.jobs)
      hasNext = result.hasNextPage
      cursor = result.endCursor
      pages++

      await new Promise(r => setTimeout(r, 600)) // Rate limit safe
    }

    // Cache only non-search results
    if (!search) {
      jobsCache = allJobs
      cacheTimestamp = now
    }

    const message = search
      ? `✅ Found ${allJobs.length} jobs matching "${search}"`
      : `✅ Loaded ${allJobs.length} recent real jobs from Upwork`

    return NextResponse.json({
      success: true,
      jobs: allJobs,
      total: allJobs.length,
      message,
      upworkConnected: true,
      cached: false
    })

  } catch (error: any) {
    console.error('❌ Server error:', error)
    if (jobsCache.length > 0) {
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        message: '⚠️ Using cached jobs (error occurred)',
        cached: true
      })
    }
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error'
    }, { status: 500 })
  }
}