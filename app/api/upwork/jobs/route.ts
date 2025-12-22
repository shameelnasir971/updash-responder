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

// 🔥 Shopify-only query
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
  lastSeenTime: number
): Promise<{ jobs: JobItem[]; newestTime: number }> {

  const response = await fetch('https://api.upwork.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: GRAPHQL_QUERY })
  })

  if (!response.ok) {
    throw new Error(await response.text())
  }

  const json: any = await response.json()
  const edges = json?.data?.marketplaceJobPostingsSearch?.edges || []

  const jobs: JobItem[] = []
  let newestTime = lastSeenTime

  for (const edge of edges) {
    const n = edge.node

    // Extra Shopify safety
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

    // ✅ only NEW jobs
    if (jobTime <= lastSeenTime) continue

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

  return {
    jobs: jobs.slice(0, MAX_JOBS),
    newestTime
  }
}

// ================= HANDLER =================
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    // Token
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

    // Last seen time
    const stateRes = await pool.query(
      'SELECT last_seen_time FROM upwork_job_state WHERE user_id = $1',
      [user.id]
    )

    const lastSeenTime = stateRes.rows[0]?.last_seen_time || 0

    const { jobs, newestTime } = await fetchShopifyJobs(
      accessToken,
      lastSeenTime
    )

    // Update state
    if (newestTime > lastSeenTime) {
      await pool.query(
        `
        INSERT INTO upwork_job_state (user_id, last_seen_time)
        VALUES ($1, $2)
        ON CONFLICT (user_id)
        DO UPDATE SET last_seen_time = $2
        `,
        [user.id, newestTime]
      )
    }

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      upworkConnected: true,
      message:
        jobs.length > 0
          ? `Loaded ${jobs.length} NEW Shopify jobs`
          : 'No new Shopify jobs yet'
    })

  } catch (error: any) {
    console.error(error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: error.message
    }, { status: 500 })
  }
}
