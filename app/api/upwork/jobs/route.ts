import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes cache
const MAX_JOBS = 300

// ✅ Aap saari major Upwork categories yahan daal sakte hain
const CATEGORY_LIST = [
  'Web Development',
  'Mobile Development',
  'Design & Creative',
  'Writing',
  'Customer Service',
  'Sales & Marketing',
  'Admin Support',
  'Engineering & Architecture',
  'Data Science & Analytics',
  'IT & Networking',
  'Legal',
  'Translation',
  'Other'
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

// ==============================
// Fetch Jobs per Category from Upwork GraphQL
// ==============================
async function fetchJobsForCategory(
  accessToken: string,
  category: string,
  search: string,
  limit = 100
): Promise<JobItem[]> {

  let jobs: JobItem[] = []
  let hasNextPage = true
  let cursor: string | null = null

  while (hasNextPage && jobs.length < limit) {
    const graphqlBody = {
      query: `
        query ($first: Int!, $after: String) {
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
        first: 50,
        after: cursor
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
      const txt = await res.text()
      throw new Error(txt)
    }

    const json: any = await res.json()
    const data = json.data?.marketplaceJobPostingsSearch
    if (!data) break

    for (const edge of data.edges || []) {
      const n = edge.node

      // 🔍 Search filter
      if (search) {
        const q = search.toLowerCase()
        const match =
          n.title?.toLowerCase().includes(q) ||
          n.description?.toLowerCase().includes(q) ||
          n.skills?.some((s: any) =>
            s?.name?.toLowerCase().includes(q)
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
        skills: n.skills?.map((s: any) => s?.name || 'Unknown Skill') || [],
        verified: true,
        source: 'upwork',
        isRealJob: true
      })

      if (jobs.length >= limit) break
    }

    hasNextPage = data.pageInfo.hasNextPage
    cursor = data.pageInfo.endCursor
  }

  return jobs
}


// ==============================
// API Handler
// ==============================
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const refresh = searchParams.get('refresh') === 'true'
const cacheKey = `${user.id}_${search || '__ALL__'}_${MAX_JOBS}`

    // ✅ Fetch user Upwork token
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

    // ✅ Return cache if valid
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

    // ======================
    // Fetch multi-category jobs
    // ======================
    const accessToken = tokenRes.rows[0].access_token
   const jobMap = new Map<string, JobItem>()

for (const cat of CATEGORY_LIST) {
  const catJobs = await fetchJobsForCategory(
    accessToken,
    cat,
    search,
    120 // per category
  )

  for (const job of catJobs) {
    if (!jobMap.has(job.id)) {
      jobMap.set(job.id, job)
    }
  }

  if (jobMap.size >= MAX_JOBS) break
}

const allJobs = Array.from(jobMap.values()).slice(0, MAX_JOBS)


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
