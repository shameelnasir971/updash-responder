// app/api/upwork/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes
const MAX_JOBS = 300
const PAGE_SIZE = 100 // Upwork limit per request
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

async function fetchJobsFromUpwork(token: string, search: string, category: string) {
  let allJobs: JobItem[] = []

  for (let page = 0; page < 3; page++) {
    const query = `
      query MarketplaceJobs($search: String, $first: Int, $offset: Int) {
        marketplaceJobPostingsSearch(search: $search, first: $first, offset: $offset) {
          edges {
            node {
              id
              title
              description
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

    const body = {
      query,
      variables: {
        search: search || null,
        first: PAGE_SIZE,
        offset: page * PAGE_SIZE
      }
    }

    const res = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!res.ok) {
      const txt = await res.text()
      throw new Error(txt)
    }

    const data: any = await res.json()
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    if (!edges.length) break

    const jobs: JobItem[] = edges.map((e: any) => {
      const n = e.node
      let budget = 'Not specified'
      if (n.amount?.rawValue) budget = `${n.amount.currency} ${n.amount.rawValue}`
      else if (n.hourlyBudgetMin?.rawValue)
        budget = `${n.hourlyBudgetMin.currency} ${n.hourlyBudgetMin.rawValue}/hr`

      return {
        id: n.id,
        title: n.title || 'Job',
        description: n.description || '',
        budget,
        postedDate: new Date(n.publishedDateTime).toLocaleDateString(),
        proposals: n.totalApplicants || 0,
        category: n.category || category,
        skills: Array.isArray(n.skills) ? n.skills.map((s: any) => s?.name || 'Unknown Skill') : [],
        verified: true,
        source: 'upwork',
        isRealJob: true
      }
    })

    allJobs.push(...jobs)

    if (allJobs.length >= MAX_JOBS) break
  }

  // Remove duplicate jobs by ID
  const uniqueJobs = Array.from(new Map(allJobs.map(j => [j.id, j])).values())
  return uniqueJobs.slice(0, MAX_JOBS)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const refresh = searchParams.get('refresh') === 'true'
    const cacheKey = search || '__ALL__'

    const tokenRes = await pool.query('SELECT access_token FROM upwork_accounts WHERE user_id = $1', [user.id])
    if (tokenRes.rows.length === 0)
      return NextResponse.json({
        success: false,
        jobs: [],
        upworkConnected: false,
        message: 'Upwork not connected'
      })

    const accessToken = tokenRes.rows[0].access_token

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
    let allJobs: JobItem[] = []
    for (const cat of CATEGORY_LIST) {
      const catJobs = await fetchJobsFromUpwork(accessToken, search, cat)
      allJobs.push(...catJobs)
      if (allJobs.length >= MAX_JOBS) break
    }

    allJobs = Array.from(new Map(allJobs.map(j => [j.id, j])).values()).slice(0, MAX_JOBS)
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
