import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_JOBS = 10 // Upwork hard limit

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

// Shopify-only query
const GRAPHQL_QUERY = `
query {
  marketplaceJobPostingsSearch(query: "shopify") {
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

async function fetchShopifyJobs(
  accessToken: string,
  lastSeenTime: number,
  forceInitialLoad: boolean
): Promise<{ jobs: JobItem[]; newestTime: number }> {

  const res = await fetch('https://api.upwork.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: GRAPHQL_QUERY })
  })

  if (!res.ok) throw new Error(await res.text())

  const json: any = await res.json()
  const edges = json?.data?.marketplaceJobPostingsSearch?.edges || []

  const jobs: JobItem[] = []
  let newestTime = lastSeenTime

  for (const edge of edges) {
    const n = edge.node

    // extra Shopify safety
    const isShopify =
      n.title?.toLowerCase().includes('shopify') ||
      n.description?.toLowerCase().includes('shopify') ||
      n.skills?.some((s: any) =>
        s?.name?.toLowerCase().includes('shopify')
      )

    if (!isShopify) continue

    const jobTime = new Date(
      n.publishedDateTime || n.createdDateTime
    ).getTime()

    // ❗ First load: sab dikhao
    if (!forceInitialLoad && jobTime <= lastSeenTime) continue

    newestTime = Math.max(newestTime, jobTime)

    let budget = 'Not specified'
    if (n.amount?.rawValue) {
      budget = `${n.amount.currency} ${n.amount.rawValue}`
    } else if (n.hourlyBudgetMin?.rawValue) {
      budget = `${n.hourlyBudgetMin.currency} ${n.hourlyBudgetMin.rawValue}/hr`
    }

    jobs.push({
      id: n.id,
      title: n.title,
      description: n.description || '',
      budget,
      postedDate: new Date(jobTime).toLocaleDateString(),
      proposals: n.totalApplicants || 0,
      category: 'Shopify',
      skills: n.skills?.map((s: any) => s.name) || [],
      verified: true,
      source: 'upwork',
      isRealJob: true
    })
  }

  return { jobs: jobs.slice(0, MAX_JOBS), newestTime }
}

// ================= API HANDLER =================
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const refresh = searchParams.get('refresh') === 'true'

    const tokenRes = await pool.query(
      'SELECT access_token, last_seen_job_time FROM upwork_accounts WHERE user_id = $1',
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

    const { access_token, last_seen_job_time } = tokenRes.rows[0]

    // forceInitialLoad = jab pehli dafa ya manual refresh
    const forceInitialLoad = last_seen_job_time === 0 || !refresh

    const { jobs, newestTime } = await fetchShopifyJobs(
      access_token,
      last_seen_job_time || 0,
      forceInitialLoad
    )

    // update DB only if new jobs aayein
    if (newestTime > (last_seen_job_time || 0)) {
      await pool.query(
        'UPDATE upwork_accounts SET last_seen_job_time = $1 WHERE user_id = $2',
        [newestTime, user.id]
      )
    }

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      upworkConnected: true,
      message: forceInitialLoad
        ? `Loaded ${jobs.length} Shopify jobs`
        : `Loaded ${jobs.length} NEW Shopify jobs`
    })

  } catch (error: any) {
    console.error('Shopify Jobs Error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: error.message
    }, { status: 500 })
  }
}
