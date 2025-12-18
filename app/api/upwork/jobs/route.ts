import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_JOBS = 300
const CACHE_TTL = 2 * 60 * 1000

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

// ================= SAFE UPWORK FETCH =================
async function tryFetchFromUpwork(
  accessToken: string
): Promise<JobItem[]> {
  const graphqlBody = {
    query: `
      query {
        marketplaceJobPostingsSearch(first: 100) {
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

  if (!res.ok) return []

  const json: any = await res.json()
  const edges = json?.data?.marketplaceJobPostingsSearch?.edges || []

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

// ================= API HANDLER =================
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.toLowerCase().trim() || ''
    const refresh = searchParams.get('refresh') === 'true'
    const cacheKey = search || '__ALL__'

    // ===== CACHE =====
    if (
      !refresh &&
      cache[cacheKey] &&
      Date.now() - cache[cacheKey].time < CACHE_TTL
    ) {
      return NextResponse.json({
        success: true,
        jobs: cache[cacheKey].jobs,
        total: cache[cacheKey].jobs.length,
        cached: true
      })
    }

    // ===== LOAD FROM DB =====
    const dbRes = await pool.query(
      `SELECT * FROM upwork_jobs ORDER BY posted_at DESC LIMIT $1`,
      [MAX_JOBS]
    )

    let jobs: JobItem[] = dbRes.rows.map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      budget: r.budget,
      postedDate: new Date(r.posted_at).toLocaleDateString(),
      proposals: r.proposals || 0,
      category: r.category,
      skills: r.skills || [],
      verified: true,
      source: 'upwork',
      isRealJob: true
    }))

    // ===== SEARCH FILTER (LOCAL) =====
    if (search) {
      jobs = jobs.filter(j =>
        j.title.toLowerCase().includes(search) ||
        j.description.toLowerCase().includes(search) ||
        j.skills.some(s => s.toLowerCase().includes(search))
      )
    }

    // ===== BACKGROUND UPWORK REFRESH =====
    if (refresh || jobs.length < 50) {
      const tokenRes = await pool.query(
        'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
        [user.id]
      )

      if (tokenRes.rows.length > 0) {
        const freshJobs = await tryFetchFromUpwork(
          tokenRes.rows[0].access_token
        )

        for (const job of freshJobs) {
          await pool.query(
            `
            INSERT INTO upwork_jobs (id, title, description, budget, category, skills, posted_at)
            VALUES ($1,$2,$3,$4,$5,$6,NOW())
            ON CONFLICT (id) DO NOTHING
          `,
            [
              job.id,
              job.title,
              job.description,
              job.budget,
              job.category,
              job.skills
            ]
          )
        }
      }
    }

    cache[cacheKey] = {
      jobs,
      time: Date.now()
    }

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      cached: false,
      message: 'Loaded jobs safely'
    })
  } catch (e: any) {
    return NextResponse.json(
      { success: false, jobs: [], message: e.message },
      { status: 500 }
    )
  }
}
