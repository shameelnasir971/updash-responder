// app/api/upwork/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ================= CONFIG =================
const CACHE_TTL = 2 * 60 * 1000 // 2 minutes
const MAX_JOBS = 300

// Default smart keywords (dashboard load)
const DEFAULT_KEYWORDS = [
  'web development',
  'react',
  'next.js',
  'shopify',
  'figma',
  'wordpress',
  'ui ux',
  'mobile app',
]

// ================= TYPES =================
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

// ================= CACHE =================
const cache: Record<
  string,
  { jobs: JobItem[]; time: number }
> = {}

// ================= GRAPHQL FETCH =================
async function fetchJobsByKeyword(
  accessToken: string,
  keyword: string,
  limit: number
): Promise<JobItem[]> {
  let jobs: JobItem[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage && jobs.length < limit) {
    const graphqlBody = {
      query: `
        query ($query: String!, $first: Int!, $after: String) {
          marketplaceJobPostingsSearch(
            query: $query,
            first: $first,
            after: $after
          ) {
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                id
                title
                description
                publishedDateTime
                createdDateTime
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
        query: keyword,
        first: 50,
        after: cursor,
      },
    }

    const res = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlBody),
    })

    if (!res.ok) {
      throw new Error(await res.text())
    }

    const json: any = await res.json()
    const data = json.data?.marketplaceJobPostingsSearch
    if (!data) break

    for (const edge of data.edges || []) {
      const n = edge.node
      if (!n?.id) continue

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
        skills: Array.isArray(n.skills)
          ? n.skills.map((s: any) => s?.name).filter(Boolean)
          : [],
        verified: true,
        source: 'upwork',
        isRealJob: true,
      })

      if (jobs.length >= limit) break
    }

    hasNextPage = data.pageInfo.hasNextPage
    cursor = data.pageInfo.endCursor
  }

  return jobs
}

// ================= API HANDLER =================
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim().toLowerCase() || ''
    const refresh = searchParams.get('refresh') === 'true'
    const cacheKey = search || '__ALL__'

    // Get Upwork token
    const tokenRes = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    if (tokenRes.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        total: 0,
        upworkConnected: false,
        message: 'Upwork not connected',
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
        message: 'Loaded jobs from cache',
      })
    }

    const accessToken = tokenRes.rows[0].access_token

    // Keywords logic
    const keywords = search ? [search] : DEFAULT_KEYWORDS

    // Deduplication map
    const jobMap = new Map<string, JobItem>()

    for (const keyword of keywords) {
      const jobs = await fetchJobsByKeyword(accessToken, keyword, 100)

      for (const job of jobs) {
        if (!jobMap.has(job.id)) {
          jobMap.set(job.id, job)
        }
      }

      if (jobMap.size >= MAX_JOBS) break
    }

    const allJobs = Array.from(jobMap.values()).slice(0, MAX_JOBS)

    cache[cacheKey] = {
      jobs: allJobs,
      time: Date.now(),
    }

    return NextResponse.json({
      success: true,
      jobs: allJobs,
      total: allJobs.length,
      cached: false,
      upworkConnected: true,
      message: `Loaded ${allJobs.length} jobs`,
    })
  } catch (e: any) {
    return NextResponse.json(
      {
        success: false,
        jobs: [],
        total: 0,
        message: e.message || 'Server error',
      },
      { status: 500 }
    )
  }
}
