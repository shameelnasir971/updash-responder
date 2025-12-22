import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_JOBS = 10 // GraphQL snapshot size

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
  link?: string
}

// ---------------- GRAPHQL (Shopify-only) ----------------
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

async function fetchGraphQLShopify(accessToken: string): Promise<JobItem[]> {
  const res = await fetch('https://api.upwork.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query: GRAPHQL_QUERY })
  })

  if (!res.ok) return []

  const json: any = await res.json()
  const edges = json?.data?.marketplaceJobPostingsSearch?.edges || []

  const jobs: JobItem[] = []
  for (const edge of edges) {
    const n = edge.node

    const isShopify =
      n.title?.toLowerCase().includes('shopify') ||
      n.description?.toLowerCase().includes('shopify') ||
      n.skills?.some((s: any) => s?.name?.toLowerCase().includes('shopify'))

    if (!isShopify) continue

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
      category: 'Shopify',
      skills: Array.isArray(n.skills) ? n.skills.map((s: any) => s.name) : [],
      verified: true,
      source: 'upwork',
      isRealJob: true
    })
  }

  return jobs.slice(0, MAX_JOBS)
}

// ---------------- RSS FALLBACK (Official Upwork) ----------------
function getTag(xml: string, tag: string) {
  const re = new RegExp(`<${tag}><!\\[CDATA\\[(.*?)\\]\\]></${tag}>`, 's')
  const m = xml.match(re)
  return m ? m[1] : ''
}

async function fetchRSSShopify(): Promise<JobItem[]> {
  const url = 'https://www.upwork.com/ab/feed/jobs/rss?q=shopify'
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  if (!res.ok) return []

  const xml = await res.text()
  const items = xml.split('<item>').slice(1)

  const jobs: JobItem[] = []
  for (const item of items) {
    const title = getTag(item, 'title')
    const link = getTag(item, 'link')
    const description = getTag(item, 'description')
    const pubDate = getTag(item, 'pubDate')
    if (!title || !link) continue

    const id = link.split('/').pop() || link
    jobs.push({
      id,
      title,
      description,
      budget: 'Check job',
      postedDate: pubDate,
      proposals: 0,
      category: 'Shopify',
      skills: [],
      verified: true,
      source: 'upwork',
      isRealJob: true,
      link
    })
    if (jobs.length >= MAX_JOBS) break
  }
  return jobs
}

// ---------------- API HANDLER ----------------
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

    // 1) Try GraphQL (preferred)
    let jobs = await fetchGraphQLShopify(accessToken)

    // 2) Fallback to RSS if GraphQL returns 0
    if (jobs.length === 0) {
      jobs = await fetchRSSShopify()
    }

    return NextResponse.json({
      success: true,
      jobs,
      total: jobs.length,
      upworkConnected: true,
      message: jobs.length
        ? `Loaded ${jobs.length} Shopify jobs`
        : 'No Shopify jobs available right now'
    })
  } catch (error: any) {
    console.error('Shopify Jobs Error:', error)
    return NextResponse.json(
      { success: false, jobs: [], message: error.message },
      { status: 500 }
    )
  }
}
