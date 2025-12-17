import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

let jobsCache: any[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000

async function fetchUpworkJobs(accessToken: string, searchTerm?: string, afterCursor?: string) {
  try {
    console.log('🚀 Fetching jobs...', searchTerm ? `Search: "${searchTerm}"` : 'All recent jobs (no filter)')

    const variables: any = {
      searchType: "USER_JOBS_SEARCH",
      sortAttributes: [
        { field: "RECENCY", direction: "DESC" }
      ],
      pagination: {
        first: 50
      }
    }

    // Only add filter if search term
    if (searchTerm) {
      variables.marketPlaceJobFilter = { q: searchTerm }
    }
    // No filter for all recent jobs

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
      const err = await response.text()
      console.error('API Error:', response.status, err.substring(0, 500))
      return { success: false, jobs: [], hasNextPage: false, endCursor: null }
    }

    const data = await response.json()

    if (data.errors) {
      console.error('GraphQL Errors:', data.errors)
      return { success: false, jobs: [], hasNextPage: false, endCursor: null }
    }

    const connection = data.data.marketplaceJobPostingsSearch
    const edges = connection?.edges || []
    const pageInfo = connection?.pageInfo || {}

    console.log(`✅ ${edges.length} jobs fetched`)

    const jobs = edges.map((edge: any) => {
      const n = edge.node

      let budget = 'Not specified'
      if (n.amount?.rawValue) {
        budget = `$${Math.round(parseFloat(n.amount.rawValue))} Fixed`
      } else if (n.hourlyBudgetMin?.rawValue || n.hourlyBudgetMax?.rawValue) {
        const min = n.hourlyBudgetMin?.rawValue ? parseFloat(n.hourlyBudgetMin.rawValue) : null
        const max = n.hourlyBudgetMax?.rawValue ? parseFloat(n.hourlyBudgetMax.rawValue) : null
        budget = min && max ? `$${min}-${max}/hr` : `$${min || max || 0}/hr`
      }

      const posted = n.publishedDateTime || n.createdDateTime || ''
      const postedDate = posted ? new Date(posted).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ago' : 'Recently'

      const skills = n.skills?.map((s: any) => s.prettyName || s.name) || []

      return {
        id: n.id,
        title: n.title || 'Untitled',
        description: n.description || '',
        budget,
        postedDate,
        client: {
          name: 'Client',
          rating: n.client?.feedbackScore || 0,
          country: n.client?.country || 'Worldwide',
          totalHires: n.client?.totalHires || 0,
          verified: n.client?.verifiedPayment || false
        },
        skills: skills.slice(0, 12),
        proposals: n.totalApplicants || 0,
        category: n.category || 'General',
        jobType: n.engagement || n.durationLabel || 'Not specified',
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
    console.error('Fetch Error:', error)
    return { success: false, jobs: [], hasNextPage: false, endCursor: null }
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const forceRefresh = searchParams.get('refresh') === 'true'

    const res = await pool.query('SELECT access_token FROM upwork_accounts WHERE user_id = $1', [user.id])
    if (res.rows.length === 0) {
      return NextResponse.json({ success: false, message: 'Connect Upwork first', upworkConnected: false })
    }

    const accessToken = res.rows[0].access_token

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

    let allJobs: any[] = []
    let cursor: string | null = null
    let hasNext = true
    let pages = 0

    while (hasNext && pages < 20) {
      const result = await fetchUpworkJobs(accessToken, search || undefined, cursor || undefined)
      if (!result.success || result.jobs.length === 0) break

      allJobs = allJobs.concat(result.jobs)
      hasNext = result.hasNextPage
      cursor = result.endCursor
      pages++

      await new Promise(r => setTimeout(r, 800))
    }

    if (!search) {
      jobsCache = allJobs
      cacheTimestamp = now
    }

    return NextResponse.json({
      success: true,
      jobs: allJobs,
      total: allJobs.length,
      message: search ? `✅ ${allJobs.length} jobs for "${search}"` : `✅ Loaded ${allJobs.length} recent real jobs`,
      upworkConnected: true,
      cached: false
    })

  } catch (error: any) {
    console.error('Server Error:', error)
    return NextResponse.json({
      success: false,
      jobs: jobsCache,
      message: 'Error – using cache'
    })
  }
}