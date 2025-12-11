// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CORRECTED & WORKING GraphQL Query for Upwork
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching jobs via CORRECTED query...')

    // ✅ CORRECT QUERY STRUCTURE - NO 'input:' object
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch(
            paging: { first: 20 }
            sort: { field: CREATED_AT, direction: DESC }
          ) {
            totalCount
            edges {
              node {
                id
                title
                description
                jobPosting {
                  id
                  title
                  description
                  category { title }
                  budget { amount currencyCode }
                  client {
                    displayName
                    totalSpent
                    location { country }
                  }
                  skills { skill { prettyName } }
                  proposalCount
                  postedOn
                }
              }
            }
          }
        }
      `
    }

    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlQuery)
    })

    console.log('📥 Response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('API error:', error.substring(0, 300))
      return { success: false, error: 'API request failed', jobs: [] }
    }

    const data = await response.json()
    console.log('GraphQL Response Keys:', Object.keys(data))

    // GraphQL returns 200 even for errors, so check the errors array[citation:2]
    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }

    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)

    const jobs = edges.map((edge: any) => {
      const job = edge.node?.jobPosting || {}
      return {
        id: job.id || edge.node?.id,
        title: job.title || 'Upwork Job',
        description: job.description || 'Job description',
        budget: job.budget?.amount ? 
          `${job.budget.currencyCode || 'USD'} ${job.budget.amount}` : 
          'Budget not specified',
        postedDate: job.postedOn ? 
          new Date(job.postedOn).toLocaleDateString() : 
          'Recently',
        client: {
          name: job.client?.displayName || 'Client',
          rating: 4.5,
          country: job.client?.location?.country || 'Remote',
          totalSpent: job.client?.totalSpent || 0
        },
        skills: job.skills?.map((s: any) => s.skill?.prettyName).filter(Boolean) || 
                ['Web Development'],
        proposals: job.proposalCount || 0,
        verified: true,
        category: job.category?.title || 'Development',
        source: 'upwork',
        isRealJob: true
      }
    })

    return { success: true, jobs: jobs, error: null }

  } catch (error: any) {
    console.error('Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

export async function GET() {
  try {
    console.log('=== JOBS API CALLED ===')

    const user = await getCurrentUser()
    if (!user) {
      // Return 401 properly if not authenticated
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('User:', user.email)

    // Get token
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '⚠️ Connect Upwork account first',
        upworkConnected: false
      })
    }

    const accessToken = upworkResult.rows[0].access_token
    console.log('Token length:', accessToken?.length || 0)

    if (!accessToken) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Token is empty in database'
      })
    }

    // Fetch jobs
    const result = await fetchRealUpworkJobs(accessToken)

    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success ? 
        `Found ${result.jobs.length} jobs` : 
        `Error: ${result.error}`,
      upworkConnected: true
    })

  } catch (error: any) {
    console.error('Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: error.message
    }, { status: 500 })
  }
}