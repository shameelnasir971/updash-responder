import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_JOBS = 10 // ⚠️ Upwork public hard limit

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

// 🔥 Shopify-only GraphQL query
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
  newOnly: boolean
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

    // 🔒 Extra Shopify safety
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

    // 🔄 NEW-only mode
    if (newOnly && jobTime <= lastSeenTime) continue

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
      skills: Array.isArray(n.skills)
        ? n.skills.map((s: any) => s.name)
        : [],
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

// ================= API HANDLER =================
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized' },
        { status: 401 }
      )
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

    const accessToken = tokenRes.rows[0].access_token
    const lastSeen = Number(tokenRes.rows[0].last_seen_job_time || 0)

    // 🔑 Rule:
    // - refresh=false → latest 10 Shopify jobs (always show)
    // - refresh=true  → NEW-only, fallback to latest if 0 new
    let newOnly = refresh === true

    // 1️⃣ Try fetch (NEW-only if refresh)
    let { jobs, newestTime } = await fetchShopifyJobs(
      accessToken,
      lastSeen,
      newOnly
    )

    // 2️⃣ Fallback: agar refresh par 0 new aayein → latest 10 dikha do
    if (refresh && jobs.length === 0) {
      const fallback = await fetchShopifyJobs(
        accessToken,
        0,
        false
      )
      jobs = fallback.jobs
      newestTime = Math.max(newestTime, fallback.newestTime)
    }

    // 3️⃣ Update DB (sirf aage badhao)
    if (newestTime > lastSeen) {
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
      message: refresh
        ? (jobs.length ? `Loaded ${jobs.length} NEW Shopify jobs` : 'Loaded latest Shopify jobs')
        : `Loaded ${jobs.length} Shopify jobs`
    })

  } catch (error: any) {
    console.error('Shopify Jobs Error:', error)
    return NextResponse.json(
      { success: false, jobs: [], message: error.message },
      { status: 500 }
    )
  }
}
