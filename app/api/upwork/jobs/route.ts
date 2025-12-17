import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ================= SETTINGS =================
const MAX_JOBS = 150        // boss approved range (100–300)
const PAGE_SIZE = 20        // Upwork safe
const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

type JobItem = {
  id: string
  title: string
  description: string
  budget: string
  postedDate: string
  proposals: number
  category: string
  skills: string[]
  verified: boolean
  source: 'upwork'
  isRealJob: true
}

const cache: Record<
  string,
  { jobs: JobItem[]; time: number }
> = {}

// ================= GRAPHQL FETCH =================
async function fetchUpworkJobs(
  accessToken: string,
  search: string
): Promise<JobItem[]> {

  let jobs: JobItem[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage && jobs.length < MAX_JOBS) {

    const graphqlBody: {
      query: string
      variables: {
        first: number
        after: string | null
      }
    } = {
      query: `
        query Jobs($first: Int!, $after: String) {
          marketplaceJobPostingsSearch(first: $first, after: $after) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                description
                createdDateTime
                publishedDateTime
                totalApplicants
                category
                skills { name }
                amount { rawValue currency }
                hourlyBudgetMin { rawValue currency }
              }
            }
          }
        }
      `,
      variables: {
        first: PAGE_SIZE,
        after: cursor
      }
    }

    const res: Response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(graphqlBody)
    })

    if (!res.ok) {
      const txt = await res.text()
      throw new Error(`Upwork API error: ${txt}`)
    }

    const json: {
      data?: {
        marketplaceJobPostingsSearch?: {
          pageInfo: {
            hasNextPage: boolean
            endCursor: string | null
          }
          edges: {
            node: any
          }[]
        }
      }
      errors?: { message: string }[]
    } = await res.json()

    if (json.errors && json.errors.length > 0) {
      throw new Error(json.errors[0].message)
    }

    const searchData =
      json.data?.marketplaceJobPostingsSearch

    if (!searchData) break

    for (const edge of searchData.edges) {
      const n = edge.node

      // 🔍 backend keyword filter
      if (search) {
        const q = search.toLowerCase()
        const match =
          n.title?.toLowerCase().includes(q) ||
          n.description?.toLowerCase().includes(q) ||
          n.skills?.some((s: any) =>
            s.name.toLowerCase().includes(q)
          )

        if (!match) continue
      }

      let budget = 'Not specified'
      if (n.amount?.rawValue) {
        budget = `${n.amount.currency} ${n.amount.rawValue}`
      } else if (n.hourlyBudgetMin?.rawValue) {
        budget = `${n.hourlyBudgetMin.currency} ${n.hourlyBudgetMin.rawValue}/hr`
      }

      jobs.push({
        id: n.id,
        title: n.title || 'Job',
        description: n.description || '',
        budget,
        postedDate: new Date(
          n.publishedDateTime || n.createdDateTime
        ).toLocaleDateString(),
        proposals: n.totalApplicants || 0,
        category: n.category || 'General',
        skills: (n.skills || []).map((s: any) => s.name),
        verified: true,
        source: 'upwork',
        isRealJob: true
      })

      if (jobs.length >= MAX_JOBS) break
    }

    hasNextPage = searchData.pageInfo.hasNextPage
    cursor = searchData.pageInfo.endCursor
  }

  return jobs
}


// ================= API HANDLER =================
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const refresh = searchParams.get('refresh') === 'true'
    const cacheKey = search || '__ALL__'

    const tokenRes = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    if (tokenRes.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        upworkConnected: false,
        message: 'Upwork not connected'
      })
    }

    // CACHE HIT
    if (
      !refresh &&
      cache[cacheKey] &&
      Date.now() - cache[cacheKey].time < CACHE_TTL
    ) {
      return NextResponse.json({
        success: true,
        jobs: cache[cacheKey].jobs,
        total: cache[cacheKey].jobs.length,
        cached: true,
        upworkConnected: true,
        message: 'Loaded jobs from cache'
      })
    }

    const accessToken = tokenRes.rows[0].access_token as string

    const jobs = await fetchUpworkJobs(accessToken, search)

    cache[cacheKey] = {
      jobs,
      time: Date.now()
    }

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      cached: false,
      upworkConnected: true,
      message: search
        ? `Found ${jobs.length} jobs for "${search}"`
        : `Loaded ${jobs.length} latest jobs`
    })
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        jobs: [],
        message: err.message || 'Server error'
      },
      { status: 500 }
    )
  }
}
