import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_JOBS = 10 // ⚠️ Upwork hard limit

// 🔒 Memory store (simple & fast)
let lastFetchedTime = 0

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

async function fetchShopifyJobs(accessToken: string): Promise<JobItem[]> {
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

  for (const edge of edges) {
    const n = edge.node

    // 🔎 Extra Shopify safety filter
    const isShopify =
      n.title?.toLowerCase().includes('shopify') ||
      n.description?.toLowerCase().includes('shopify') ||
      (Array.isArray(n.skills) &&
        n.skills.some((s: any) =>
          s?.name?.toLowerCase().includes('shopify')
        ))

    if (!isShopify) continue

    // 🕒 NEW jobs only (reload logic)
    const jobTime = new Date(
      n.publishedDateTime || n.createdDateTime
    ).getTime()

    if (jobTime <= lastFetchedTime) continue

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
      postedDate: new Date(
        n.publishedDateTime || n.createdDateTime
      ).toLocaleDateString(),
      proposals: n.totalApplicants || 0,
      category: n.category || 'Shopify',
      skills: Array.isArray(n.skills)
        ? n.skills.map((s: any) => s?.name || '')
        : [],
      verified: true,
      source: 'upwork',
      isRealJob: true
    })
  }

  // 🧠 Update last fetch time
  if (jobs.length > 0) {
    lastFetchedTime = Date.now()
  }

  return jobs.slice(0, MAX_JOBS)
}

// ================= API HANDLER =================
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

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

    const jobs = await fetchShopifyJobs(accessToken)

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      upworkConnected: true,
      message: `Loaded ${jobs.length} NEW Shopify jobs`
    })

  } catch (error: any) {
    console.error('Upwork Shopify Jobs Error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: error.message
    }, { status: 500 })
  }
}
