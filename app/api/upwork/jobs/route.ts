// app/api/upwork/jobs/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes
const MAX_JOBS = 50
const SEARCH_KEYWORD = 'Shopify' // Change to '' for any jobs

type JobItem = {
  id: string
  title: string
  description: string
  budget: string
  postedDate: string
  proposals: number
  category: string
  skills: string[]
  source: 'upwork'
  isRealJob: boolean
}

const cache: { jobs: JobItem[]; time: number } = { jobs: [], time: 0 }

async function fetchJobsFromUpwork(accessToken: string): Promise<JobItem[]> {
  try {
    const graphqlBody = {
      query: `
        query {
          marketplaceJobPostingsSearch(first: 50, query: "${SEARCH_KEYWORD}") {
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

    const jobs: JobItem[] = edges.map((edge: any) => {
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
        postedDate: new Date(n.publishedDateTime || n.createdDateTime).toLocaleDateString(),
        proposals: n.totalApplicants || 0,
        category: n.category || 'General',
        skills: Array.isArray(n.skills) ? n.skills.map((s: any) => s.name) : [],
        source: 'upwork',
        isRealJob: true
      }
    })

    return jobs.slice(0, MAX_JOBS)
  } catch (e) {
    console.error('Error fetching jobs:', e)
    return []
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const refresh = searchParams.get('refresh') === 'true'

    // CACHE HIT
    if (!refresh && cache.jobs.length && Date.now() - cache.time < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        jobs: cache.jobs,
        total: cache.jobs.length,
        cached: true,
        message: 'Loaded jobs from cache'
      })
    }

    // Get access token
    const tokenRes = await pool.query('SELECT access_token FROM upwork_accounts WHERE user_id = $1', [user.id])
    if (!tokenRes.rows.length) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Upwork not connected'
      })
    }
    const accessToken = tokenRes.rows[0].access_token

    // Fetch latest jobs
    let jobs = await fetchJobsFromUpwork(accessToken)

    // Fallback: old jobs if latest fetch fails
    if (!jobs.length && cache.jobs.length) {
      jobs = cache.jobs
    }

    cache.jobs = jobs
    cache.time = Date.now()

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      cached: false,
      message: jobs.length ? 'Loaded latest Shopify jobs' : 'No Shopify jobs available. Please refresh later.'
    })
  } catch (e: any) {
    console.error(e)
    return NextResponse.json({ success: false, jobs: [], message: 'Internal Server Error' }, { status: 500 })
  }
}
