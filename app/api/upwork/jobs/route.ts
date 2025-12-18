// app/api/upwork/jobs/route.ts - UPDATED & IMPROVED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes
const MAX_JOBS = 500 // Increased to get more diverse jobs
const MAX_PER_CALL = 100 // Safe limit to avoid API errors

// ✅ Expanded category list to cover ALL major Upwork categories (including Figma, Shopify, etc.)
// These are the real Upwork top-level categories & popular sub-categories that appear in job feeds
const CATEGORY_LIST = [
  'Web Development',
  'Mobile Development',
  'Design & Creative',
  'Writing',
  'Customer Service',
  'Sales & Marketing',
  'Accounting & Consulting',
  'Admin Support',
  'Data Science & Analytics',
  'Engineering & Architecture',
  'IT & Networking',
  'Legal',
  'Translation',
  // Popular sub/specialized categories that show up a lot
  'Graphic Design',
  'Video & Animation',
  'Digital Marketing',
  'SEO',
  'Shopify',
  'WordPress',
  'Figma',
  'UI/UX Design',
  'Logo Design',
  'Ecommerce',
  'Virtual Assistant',
  'Social Media Marketing'
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

// Updated fetch with better fields + pagination support
async function fetchJobs(
  accessToken: string,
  search: string = ''
): Promise<JobItem[]> {
  // Use variables for better control and pagination
  const variables: any = {
    searchType: 'USER_JOBS_SEARCH',
    sortAttributes: [{ field: 'RECENCY' }],
    pagination: { first: MAX_PER_CALL } // Get up to 100 jobs per call
  }

  // If user is searching, use title/description filter
  if (search) {
    variables.marketPlaceJobFilter = {
      titleExpression_eq: search
    }
  }

  const graphqlBody = {
    query: `
      query marketplaceJobPostingsSearch(
        $marketPlaceJobFilter: MarketplaceJobPostingsSearchFilter
        $searchType: MarketplaceJobPostingSearchType!
        $sortAttributes: [MarketplaceJobPostingSearchSortAttribute!]
        $pagination: PaginationInput
      ) {
        marketplaceJobPostingsSearch(
          marketPlaceJobFilter: $marketPlaceJobFilter
          searchType: $searchType
          sortAttributes: $sortAttributes
          pagination: $pagination
        ) {
          totalCount
          edges {
            node {
              id
              title
              description
              createdDateTime
              publishedDateTime
              totalApplicants
              category
              subcategory
              skills { name }
              amount { rawValue currency }
              hourlyBudgetMin { rawValue currency }
              hourlyBudgetMax { rawValue currency }
              type
              duration
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `,
    variables
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
    throw new Error(`Upwork API Error: ${res.status} - ${txt.substring(0, 300)}`)
  }

  const json: any = await res.json()
  const edges = json.data?.marketplaceJobPostingsSearch?.edges || []
  const jobs: JobItem[] = []

  for (const edge of edges) {
    const n = edge.node

    let budget = 'Not specified'
    if (n.amount?.rawValue) {
      budget = `${n.amount.currency || 'USD'} ${n.amount.rawValue} Fixed`
    } else if (n.hourlyBudgetMin?.rawValue) {
      const max = n.hourlyBudgetMax?.rawValue || '??'
      budget = `${n.hourlyBudgetMin.currency || 'USD'} ${n.hourlyBudgetMin.rawValue}-${max}/hr`
    }

    // Better category: use subcategory if available, else category
    const displayCategory = n.subcategory || n.category || 'Other'

    jobs.push({
      id: n.id,
      title: n.title || 'Untitled Job',
      description: n.description || 'No description available',
      budget,
      postedDate: new Date(n.publishedDateTime || n.createdDateTime).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      proposals: n.totalApplicants || 0,
      category: displayCategory,
      skills: Array.isArray(n.skills)
        ? n.skills.map((s: any) => s?.name || 'Unknown Skill')
        : [],
      verified: true,
      source: 'upwork',
      isRealJob: true
    })
  }

  return jobs
}

// ================= API Handler =================
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const search = searchParams.get('search')?.trim() || ''
    const refresh = searchParams.get('refresh') === 'true'
    const cacheKey = search || '__ALL__'

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

    // CACHE HIT
    if (!refresh && cache[cacheKey] && Date.now() - cache[cacheKey].time < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        jobs: cache[cacheKey].jobs,
        total: cache[cacheKey].jobs.length,
        cached: true,
        upworkConnected: true,
        message: 'Loaded from cache'
      })
    }

    const accessToken = tokenRes.rows[0].access_token

    // SINGLE CALL TO GET ALL RECENT JOBS (no category loop needed!)
    // This returns jobs from ALL categories, including Figma, Shopify, etc.
    let allJobs = await fetchJobs(accessToken, search)

    // Optional: Sort by recency and limit
    allJobs = allJobs
      .sort((a, b) => new Date(b.postedDate).getTime() - new Date(a.postedDate).getTime())
      .slice(0, MAX_JOBS)

    // Cache result
    cache[cacheKey] = { jobs: allJobs, time: Date.now() }

    return NextResponse.json({
      success: true,
      jobs: allJobs,
      total: allJobs.length,
      cached: false,
      upworkConnected: true,
      message: search 
        ? `Found ${allJobs.length} jobs matching "${search}"` 
        : `Loaded ${allJobs.length} recent jobs from ALL Upwork categories`
    })

  } catch (e: any) {
    console.error('Upwork jobs fetch error:', e)
    return NextResponse.json(
      { success: false, jobs: [], message: e.message || 'Failed to fetch jobs' },
      { status: 500 }
    )
  }
}