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

// 🔥 REAL Upwork GraphQL Query with Pagination
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

async function fetchUpworkJobs(
  accessToken: string,
  search: string,
  maxJobs = 300
): Promise<JobItem[]> {

  let jobs: JobItem[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage && jobs.length < maxJobs) {

    // ✅ res -> response (duplicate name fix)
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query: GRAPHQL_QUERY,
        variables: {
          query: search || '',
          first: 50,
          after: cursor
        }
      })
    })

    if (!response.ok) {
      throw new Error(await response.text())
    }

    // ✅ json typed
    const json: any = await response.json()

    // ✅ data typed safely
    const searchData = json?.data?.marketplaceJobPostingsSearch

    if (!searchData) break

    for (const edge of searchData.edges) {
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

    hasNextPage = searchData.pageInfo.hasNextPage
    cursor = searchData.pageInfo.endCursor
  }

  return jobs.slice(0, maxJobs)
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search') || ''

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

    const accessToken = tokenRes.rows[0].access_token

    const jobs = await fetchUpworkJobs(accessToken, search, 300)

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      upworkConnected: true,
      message: `Loaded ${jobs.length} REAL Upwork jobs`
    })

  } catch (error: any) {
    console.error('Upwork Jobs Error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: error.message
    }, { status: 500 })
  }
}
