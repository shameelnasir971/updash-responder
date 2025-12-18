// app/api/upwork/jobs/route.ts - FINAL PRODUCTION VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes
const MAX_JOBS = 300

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


// ================= FETCH JOBS =================
async function fetchJobs(
  accessToken: string,
  search: string
): Promise<JobItem[]> {

  const graphqlBody = {
    query: `
      query ($query: String) {
        marketplaceJobPostingsSearch(
          first: 100
          query: $query
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
      query: search || null
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
    throw new Error(await res.text())
  }

  const json: any = await res.json()
  const edges = json.data?.marketplaceJobPostingsSearch?.edges || []

  const jobs: JobItem[] = []

  for (const edge of edges) {
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
      isRealJob: true
    })

    if (jobs.length >= MAX_JOBS) break
  }

  return jobs
}


// ================= API HANDLER =================
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const refresh = searchParams.get('refresh') === 'true'
    const cacheKey = search || '__LATEST__'

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
    if (!refresh && cache[cacheKey] && Date.now() - cache[cacheKey].time < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        jobs: cache[cacheKey].jobs,
        total: cache[cacheKey].jobs.length,
        cached: true,
        upworkConnected: true,
        message: 'Loaded from cache'
      })
    }

    const accessToken = tokenRes.rows[0].access_token
    const jobs = await fetchJobs(accessToken, search)

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
        ? `Fresh ${jobs.length} jobs for "${search}"`
        : `Latest ${jobs.length} jobs loaded`
    })

  } catch (e: any) {
    return NextResponse.json(
      { success: false, jobs: [], message: e.message },
      { status: 500 }
    )
  }
}
