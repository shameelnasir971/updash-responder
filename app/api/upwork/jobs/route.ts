import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

const GRAPHQL_QUERY = `
query SearchJobs($query: String!, $first: Int!, $after: String) {
  marketplaceJobPostingsSearch(
    query: $query
    first: $first
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

const SEARCH_KEYWORDS = [
  'website',
  'wordpress',
  'react',
  'javascript',
  'php',
  'laravel',
  'python',
  'frontend',
  'backend',
  'developer',
  'design',
  'api',
  'software',
  'app',
  'mobile'
]

async function fetchJobsForKeyword(
  token: string,
  keyword: string,
  maxPerKeyword = 80
): Promise<JobItem[]> {

  let jobs: JobItem[] = []
  let cursor: string | null = null
  let hasNext = true

  while (hasNext && jobs.length < maxPerKeyword) {
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: GRAPHQL_QUERY,
        variables: {
          query: keyword,
          first: 40,
          after: cursor
        }
      })
    })

    if (!response.ok) break

    const json: any = await response.json()
    const data = json?.data?.marketplaceJobPostingsSearch
    if (!data) break

    for (const edge of data.edges) {
      const n = edge.node

      jobs.push({
        id: n.id,
        title: n.title,
        description: n.description || '',
        budget: n.amount?.rawValue
          ? `${n.amount.currency} ${n.amount.rawValue}`
          : n.hourlyBudgetMin?.rawValue
          ? `${n.hourlyBudgetMin.currency} ${n.hourlyBudgetMin.rawValue}/hr`
          : 'Not specified',
        postedDate: new Date(n.publishedDateTime).toLocaleDateString(),
        proposals: n.totalApplicants || 0,
        category: n.category || 'Other',
        skills: n.skills?.map((s: any) => s.name) || [],
        verified: true,
        source: 'upwork',
        isRealJob: true
      })
    }

    hasNext = data.pageInfo.hasNextPage
    cursor = data.pageInfo.endCursor
  }

  return jobs
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, jobs: [] }, { status: 401 })
    }

    const tokenRes = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    if (tokenRes.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Upwork not connected'
      })
    }

    const token = tokenRes.rows[0].access_token

    const jobMap = new Map<string, JobItem>()

    for (const keyword of SEARCH_KEYWORDS) {
      const jobs = await fetchJobsForKeyword(token, keyword)

      for (const job of jobs) {
        jobMap.set(job.id, job) // ✅ removes duplicates
      }

      if (jobMap.size >= 300) break
    }

    const finalJobs = Array.from(jobMap.values()).slice(0, 300)

    return NextResponse.json({
      success: true,
      jobs: finalJobs,
      count: finalJobs.length,
      cached: false,
      message: `Loaded ${finalJobs.length} REAL Upwork jobs`
    })

  } catch (err: any) {
    console.error(err)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: err.message
    }, { status: 500 })
  }
}
