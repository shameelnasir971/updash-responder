// app/api/upwork/jobs/route.ts
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
  'Figma',
  'Shopify',
  'Shopify Theme Developer'
  // aap aur categories add kar sakte hain
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

// Helper: fetch jobs per category with pagination
async function fetchJobsForCategory(
  accessToken: string,
  category: string,
  search: string
): Promise<JobItem[]> {
  let jobs: JobItem[] = []
  let hasNextPage = true
  let after: string | null = null

  while (hasNextPage && jobs.length < MAX_JOBS) {
    const graphqlBody = {
      query: `
        query($first: Int!, $after: String, $search: String) {
          marketplaceJobPostingsSearch(first: $first, after: $after, query: $search) {
            edges {
              cursor
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
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      variables: {
        first: 50,
        after,
        search: search || category
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
      throw new Error(`Upwork API Error: ${txt}`)
    }

    const json: any = await res.json()
    const edges = json.data?.marketplaceJobPostingsSearch?.edges || []
    const pageInfo = json.data?.marketplaceJobPostingsSearch?.pageInfo

    for (const edge of edges) {
      const n = edge.node
      const budget = n.amount?.rawValue
        ? `${n.amount.currency} ${n.amount.rawValue}`
        : n.hourlyBudgetMin?.rawValue
        ? `${n.hourlyBudgetMin.currency} ${n.hourlyBudgetMin.rawValue}/hr`
        : 'Not specified'

      jobs.push({
        id: n.id,
        title: n.title || 'Job',
        description: n.description || '',
        budget,
        postedDate: new Date(n.publishedDateTime || n.createdDateTime).toLocaleDateString(),
        proposals: n.totalApplicants || 0,
        category: n.category || category,
        skills: Array.isArray(n.skills) ? n.skills.map((s: any) => s.name || 'Unknown Skill') : [],
        verified: true,
        source: 'upwork',
        isRealJob: true
      })
    }

    after = pageInfo?.endCursor || null
    hasNextPage = pageInfo?.hasNextPage
  }

  // Remove duplicate jobs
  const uniqueJobs = Array.from(new Map(jobs.map(j => [j.id, j])).values())
  return uniqueJobs.slice(0, MAX_JOBS)
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

    // FETCH JOBS
    const accessToken = tokenRes.rows[0].access_token
    let allJobs: JobItem[] = []

    for (const cat of CATEGORY_LIST) {
      const catJobs = await fetchJobsForCategory(accessToken, cat, search)
      allJobs.push(...catJobs)
      if (allJobs.length >= MAX_JOBS) break
    }

    // Remove duplicates again (cross-category duplicates)
    allJobs = Array.from(new Map(allJobs.map(j => [j.id, j])).values()).slice(0, MAX_JOBS)

    cache[cacheKey] = { jobs: allJobs, time: Date.now() }

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
