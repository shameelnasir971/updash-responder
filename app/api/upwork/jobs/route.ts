import { NextRequest, NextResponse } from 'next/server'
import pool from '../../../../lib/database'
import { getCurrentUser } from '../../../../lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes
const MAX_JOBS = 300

type Job = {
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

const cache: Record<string, { jobs: Job[]; time: number }> = {}

async function fetchJobsGraphQL(accessToken: string, query: string, offset = 0, count = 50) {
  const graphqlQuery = `
    query JobSearch($query: String!, $offset: Int!, $count: Int!) {
      marketplaceJobPostingsSearch(
        filter: { query: $query }
        sort: { field: CREATED_DATE, order: DESC }
        paging: { offset: $offset, count: $count }
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
  `

  const res = await fetch('https://api.upwork.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: graphqlQuery,
      variables: { query, offset, count },
    }),
  })

  if (!res.ok) throw new Error(`GraphQL fetch failed: ${res.statusText}`)

  const json: any = await res.json()
  return json.data?.marketplaceJobPostingsSearch?.edges || []
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false }, { status: 401 })

    const tokenRes = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    if (tokenRes.rows.length === 0)
      return NextResponse.json({
        success: false,
        jobs: [],
        total: 0,
        upworkConnected: false,
        message: 'Upwork not connected',
      })

    const accessToken = tokenRes.rows[0].access_token
    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const refresh = searchParams.get('refresh') === 'true'
    const cacheKey = `${search || '__ALL__'}_${MAX_JOBS}`

    if (!refresh && cache[cacheKey] && Date.now() - cache[cacheKey].time < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        jobs: cache[cacheKey].jobs,
        total: cache[cacheKey].jobs.length,
        cached: true,
        upworkConnected: true,
        message: 'Loaded jobs from cache',
      })
    }

    const keywords = search
      ? [search]
      : [
          'web development',
          'javascript',
          'react',
          'shopify',
          'figma',
          'wordpress',
          'mobile development',
          'design',
        ]

    const jobMap = new Map<string, Job>()

    for (const keyword of keywords) {
      let offset = 0
      const perPage = 50
      while (jobMap.size < MAX_JOBS) {
        const edges = await fetchJobsGraphQL(accessToken, keyword, offset, perPage)
        if (!edges.length) break

        for (const { node } of edges) {
          if (!node?.id || jobMap.has(node.id)) continue

          let budget = 'Not specified'
          if (node.amount?.rawValue) budget = `${node.amount.currency} ${node.amount.rawValue}`
          else if (node.hourlyBudgetMin?.rawValue) budget = `${node.hourlyBudgetMin.currency} ${node.hourlyBudgetMin.rawValue}/hr`

          jobMap.set(node.id, {
            id: node.id,
            title: node.title || 'Job',
            description: node.description || '',
            budget,
            postedDate: new Date(node.publishedDateTime || node.createdDateTime).toLocaleDateString(),
            proposals: node.totalApplicants || 0,
            category: node.category || 'General',
            skills: Array.isArray(node.skills) ? node.skills.map((s: any) => s?.name).filter(Boolean) : [],
            verified: true,
            source: 'upwork',
            isRealJob: true,
          })

          if (jobMap.size >= MAX_JOBS) break
        }

        if (edges.length < perPage) break
        offset += perPage
      }

      if (jobMap.size >= MAX_JOBS) break
    }

    const jobs = Array.from(jobMap.values())
    cache[cacheKey] = { jobs, time: Date.now() }

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      cached: false,
      upworkConnected: true,
      message: `Loaded ${jobs.length} jobs`,
    })
  } catch (e: any) {
    return NextResponse.json({ success: false, jobs: [], message: e.message }, { status: 500 })
  }
}
