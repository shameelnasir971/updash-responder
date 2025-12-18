import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'
import { json } from 'stream/consumers'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_JOBS = 300
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

const cache: Record<string, { jobs: JobItem[]; time: number }> = {}

// ================= FETCH FROM UPWORK =================
async function fetchJobsFromUpwork(
  accessToken: string,
  search: string
): Promise<JobItem[]> {

  const graphqlBody = {
    query: `
      query JobSearch($search: String) {
        marketplaceJobPostingsSearch(
          first: 100
          filter: {
            query: $search
          }
        ) {
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
      search: search || null
    }
  }

  const res = await fetch('https://api.upwork.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(graphqlBody)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(text)
  }

  const json: any = await res.json()

  const edges =
    json?.data?.marketplaceJobPostingsSearch?.edges || []

  if (edges.length === 0) {
    console.warn('⚠️ No jobs returned from Upwork')
  }

  return edges.map((edge: any) => {
    const n = edge.node

    let budget = 'Not specified'
    if (n.amount?.rawValue) {
      budget = `${n.amount.currency} ${n.amount.rawValue}`
    } else if (n.hourlyBudgetMin?.rawValue) {
      budget = `${n.hourlyBudgetMin.currency} ${n.hourlyBudgetMin.rawValue}/hr`
    }

    return {
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
        ? n.skills.map((s: any) => s?.name || '')
        : [],
      verified: true,
      source: 'upwork',
      isRealJob: true
    }
  })
}

console.log(
  '🧪 Upwork raw response:',
  JSON.stringify(json, null, 2)
)

// ================= API HANDLER =================
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
        upworkConnected: false
      })
    }

    // ================= CACHE =================
    if (
      !search &&
      !refresh &&
      cache[cacheKey] &&
      Date.now() - cache[cacheKey].time < CACHE_TTL
    ) {
      return NextResponse.json({
        success: true,
        jobs: cache[cacheKey].jobs,
        total: cache[cacheKey].jobs.length,
        cached: true,
        upworkConnected: true
      })
    }

    // ================= FETCH =================
    const accessToken = tokenRes.rows[0].access_token
    let allJobs: JobItem[] = []

    while (allJobs.length < MAX_JOBS) {
      const newJobs = await fetchJobsFromUpwork(accessToken, search)
      if (newJobs.length === 0) break

      allJobs.push(...newJobs)

      // avoid infinite loop
      if (newJobs.length < 100) break
    }

    allJobs = allJobs.slice(0, MAX_JOBS)

    cache[cacheKey] = {
      jobs: allJobs,
      time: Date.now()
    }

    return NextResponse.json({
      success: true,
      jobs: allJobs,
      total: allJobs.length,
      cached: false,
      upworkConnected: true,
      message: search
        ? `Found ${allJobs.length} jobs for "${search}"`
        : `Loaded ${allJobs.length} jobs`
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, jobs: [], message: e.message },
      { status: 500 }
    )
  }
}
