// app/api/upwork/jobs/route.ts
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

// Fetch jobs for a category
async function fetchJobs(accessToken: string, search: string): Promise<JobItem[]> {
  const query = `
    query marketplaceJobPostingsSearch($search: String) {
      marketplaceJobPostingsSearch(search: $search, first: ${MAX_JOBS}) {
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
  `
  const body = JSON.stringify({ query, variables: { search: search || null } })

  const res = await fetch('https://api.upwork.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body
  })

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(txt)
  }

  const json: any = await res.json()
  const edges = json.data?.marketplaceJobPostingsSearch?.edges || []

  const jobs: JobItem[] = edges.map((edge: any) => {
    const n = edge.node
    let budget = 'Not specified'
    if (n.amount?.rawValue) budget = `${n.amount.currency} ${n.amount.rawValue}`
    else if (n.hourlyBudgetMin?.rawValue) budget = `${n.hourlyBudgetMin.currency} ${n.hourlyBudgetMin.rawValue}/hr`

    return {
      id: n.id,
      title: n.title || 'Job',
      description: n.description || '',
      budget,
      postedDate: new Date(n.publishedDateTime || n.createdDateTime).toLocaleDateString(),
      proposals: n.totalApplicants || 0,
      category: n.category || 'Uncategorized',
      skills: Array.isArray(n.skills) ? n.skills.map((s: any) => s?.name || 'Unknown Skill') : [],
      verified: true,
      source: 'upwork',
      isRealJob: true
    }
  })

  // Remove duplicate jobs by ID
  const uniqueJobs = Array.from(new Map(jobs.map(j => [j.id, j])).values())
  return uniqueJobs
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const refresh = searchParams.get('refresh') === 'true'
    const cacheKey = search || '__ALL__'

    const tokenRes = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    if (tokenRes.rows.length === 0)
      return NextResponse.json({
        success: false,
        jobs: [],
        upworkConnected: false,
        message: 'Upwork not connected'
      })

    // CACHE HIT
    if (!refresh && cache[cacheKey] && Date.now() - cache[cacheKey].time < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        jobs: cache[cacheKey].jobs,
        total: cache[cacheKey].jobs.length,
        cached: true,
        upworkConnected: true,
        message: 'Loaded jobs from cache'
      })
    }

    const accessToken = tokenRes.rows[0].access_token
    const jobs = await fetchJobs(accessToken, search)

    cache[cacheKey] = { jobs, time: Date.now() }

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      cached: false,
      upworkConnected: true,
      message: search ? `Found ${jobs.length} jobs for "${search}"` : `Loaded ${jobs.length} jobs`
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, jobs: [], message: e.message },
      { status: 500 }
    )
  }
}
