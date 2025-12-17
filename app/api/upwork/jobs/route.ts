import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes
const MAX_JOBS = 300
const CATEGORY_LIST = [
  'Web Development',
  'Mobile Development',
  'Design & Creative',
  'Writing',
  'Customer Service',
  'Sales & Marketing',
]

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

// Fetch jobs for a single category
async function fetchJobsForCategory(
  accessToken: string,
  category: string,
  search: string
): Promise<JobItem[]> {
  const graphqlBody = {
    query: `
      query {
        marketplaceJobPostingsSearch {
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
    const txt = await res.text()
    throw new Error(txt)
  }

  const json: any = await res.json()
  const edges = json.data?.marketplaceJobPostingsSearch?.edges || []

  const jobs: JobItem[] = []

  for (const edge of edges) {
    const n = edge.node
    // Filter by search keyword
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
      category: n.category || category,
      skills: (n.skills || []).map((s: any) => s.name),
      verified: true,
      source: 'upwork',
      isRealJob: true
    })
  }

  return jobs
}

// ================= API Handler =================
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

    // Multi-category fetch
    const accessToken = tokenRes.rows[0].access_token
    let allJobs: JobItem[] = []

    for (const cat of CATEGORY_LIST) {
      const catJobs = await fetchJobsForCategory(accessToken, cat, search)
      allJobs.push(...catJobs)
      if (allJobs.length >= MAX_JOBS) break
    }

    allJobs = allJobs.slice(0, MAX_JOBS)
    cache[cacheKey] = { jobs: allJobs, time: Date.now() }

    return NextResponse.json({
      success: true,
      jobs: allJobs,
      total: allJobs.length,
      cached: false,
      upworkConnected: true,
      message: search ? `Found ${allJobs.length} jobs for "${search}"` : `Loaded ${allJobs.length} jobs`
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, jobs: [], message: e.message },
      { status: 500 }
    )
  }
}
