import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Cache (5 minutes)
let jobsCache: any[] = []
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

async function fetchUpworkJobs(accessToken: string, searchTerm?: string, afterCursor?: string) {
  try {
    console.log('🚀 Fetching Upwork jobs...', searchTerm ? `Keyword: "${searchTerm}"` : 'Recent jobs (last 30 days)')

    const variables: any = {
      searchType: "USER_JOBS_SEARCH",
      marketPlaceJobFilter: {
        daysPosted_eq: 30, // Last 30 days jobs
      },
      sortAttributes: [
        { field: "RECENCY", direction: "DESC" } // Newest first
      ],
      pagination: {
        first: 50 // Max batch size (try 100 if works)
      }
    }

    // Add keyword search if provided
    if (searchTerm) {
      variables.marketPlaceJobFilter.q = searchTerm
    }

    // Add pagination cursor if provided
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
                  displayValue
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
                  verifiedPayment
                  country
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
      return { success: false, jobs: [], hasNextPage: false, endCursor: null, totalCount: 0 }
    }

    const data = await response.json()

    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { success: false, jobs: [], hasNextPage: false, endCursor: null, totalCount: 0 }
    }

    const connection = data.data?.marketplaceJobPostingsSearch
    const edges = connection?.edges || []
    const pageInfo = connection?.pageInfo || {}
    const totalCount = connection?.totalCount || 0

    console.log(`✅ Page fetched: ${edges.length} jobs, hasNext: ${pageInfo.hasNextPage}, total: ${totalCount}`)

    const jobs = edges.map((edge: any) => {
      const node = edge.node

      // Budget formatting
      let budgetText = 'Not specified'
      if (node.amount?.rawValue) {
        budgetText = `$${parseFloat(node.amount.rawValue).toFixed(2)} ${node.amount.currency || 'USD'}`
      } else if (node.hourlyBudgetMin || node.hourlyBudgetMax) {
        const min = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : null
        const max = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : null
        if (min && max) {
          budgetText = `$${min}-${max}/hr`
        } else if (min || max) {
          budgetText = `$${min || max}/hr`
        }
      }

      // Date
      const postedDate = node.publishedDateTime || node.createdDateTime || new Date().toISOString()
      const formattedDate = new Date(postedDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })

      // Skills
      const skills = node.skills?.map((s: any) => s.prettyName || s.name) || []

      // Client
      const client = node.client || {}

      return {
        id: node.id,
        title: node.title || 'Untitled Job',
        description: node.description || '',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: 'Client',
          rating: client.feedbackScore || 0,
          country: client.country || 'Remote',
          totalSpent: 0,
          totalHires: client.totalHires || 0,
          verified: client.verifiedPayment || false
        },
        skills: skills.slice(0, 15),
        proposals: node.totalApplicants || 0,
        verified: true,
        category: node.category || 'General',
        jobType: node.engagement || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })

    return {
      success: true,
      jobs,
      hasNextPage: pageInfo.hasNextPage || false,
      endCursor: pageInfo.endCursor,
      totalCount
    }

  } catch (error: any) {
    console.error('❌ Fetch error:', error)
    return { success: false, jobs: [], hasNextPage: false, endCursor: null, totalCount: 0 }
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
    if (!forceRefresh && jobsCache.length > 0 && (now - cacheTimestamp) < CACHE_DURATION && !search) {
      console.log('📦 Serving cached jobs')
      return NextResponse.json({
        success: true,
        jobs: jobsCache,
        message: `✅ ${jobsCache.length} recent jobs (cached)`,
        upworkConnected: true,
        cached: true
      })
    }

    // Fetch with pagination
    let allJobs: any[] = []
    let cursor: string | null = null
    let hasNext = true
    let totalFetched = 0

    while (hasNext && totalFetched < 500) { // Safety limit to avoid infinite loop
      const result = await fetchUpworkJobs(accessToken, search || undefined, cursor || undefined)

      if (!result.success) {
        break
      }

      allJobs = allJobs.concat(result.jobs)
      totalFetched += result.jobs.length

      hasNext = result.hasNextPage
      cursor = result.endCursor

      console.log(`📈 Total fetched so far: ${totalFetched}`)
      
      // Small delay to be safe
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Update cache only for no-search
    if (!search) {
      jobsCache = allJobs
      cacheTimestamp = now
    }

    const message = search
      ? `✅ Found ${allJobs.length} jobs for "${search}" (last 30 days)`
      : `✅ Loaded ${allJobs.length} recent real jobs (last 30 days)`

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
        message: '⚠️ Using cached jobs due to error',
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