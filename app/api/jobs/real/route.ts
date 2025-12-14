//app/api/jobs/real/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchRealUpworkJobs(accessToken: string, page: number = 1, limit: number = 50) {
  try {
    console.log(`📊 Fetching Upwork jobs - Page: ${page}, Limit: ${limit}`)
    
    // Get user's preferences for filtering
    const user = await getCurrentUser()
    const prefs = await pool.query(
      `SELECT job_preferences FROM prompt_settings WHERE user_id = $1`,
      [user?.id]
    )
    
    const preferences = prefs.rows[0]?.job_preferences || {
      minBudget: 100,
      maxBudget: 10000,
      categories: ["Web Development", "Mobile App Development"],
      countries: ["Worldwide"],
      jobTypes: ["Fixed", "Hourly"],
      experienceLevels: ["Intermediate", "Expert"],
      onlyVerifiedClients: true
    }

    // GraphQL query with pagination
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs($first: Int, $offset: Int) {
          marketplaceJobPostingsSearch(
            first: $first, 
            offset: $offset,
            sortBy: { field: PUBLISHED_DATE, direction: DESC }
          ) {
            edges {
              node {
                id
                title
                description
                amount {
                  rawValue
                  currency
                  displayValue
                }
                hourlyBudgetMin {
                  rawValue
                  currency
                  displayValue
                }
                hourlyBudgetMax {
                  rawValue
                  currency
                  displayValue
                }
                skills {
                  name
                }
                totalApplicants
                category
                createdDateTime
                publishedDateTime
                experienceLevel
                engagement
                duration
                durationLabel
                client {
                  name
                  rating
                  country
                  totalSpent
                  totalHires
                  isPaymentVerified
                }
              }
            }
            totalCount
          }
        }
      `,
      variables: {
        first: limit,
        offset: (page - 1) * limit
      }
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Upwork API error:', errorText)
      throw new Error('Failed to fetch jobs from Upwork')
    }

    const data = await response.json()
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      throw new Error(data.errors[0]?.message || 'GraphQL error')
    }

    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    const totalCount = data.data?.marketplaceJobPostingsSearch?.totalCount || 0
    
    console.log(`✅ Found ${edges.length} jobs, Total: ${totalCount}`)

    // Filter jobs based on user preferences
    const filteredJobs = edges
      .map((edge: any) => {
        const node = edge.node
        
        // Format budget
        let budgetText = 'Budget not specified'
        if (node.amount?.rawValue) {
          const amount = parseFloat(node.amount.rawValue)
          budgetText = node.amount.displayValue || `$${amount.toFixed(2)}`
        } else if (node.hourlyBudgetMin?.rawValue) {
          const min = parseFloat(node.hourlyBudgetMin.rawValue)
          const max = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : min
          budgetText = max > min 
            ? `$${min.toFixed(2)}-${max.toFixed(2)}/hr`
            : `$${min.toFixed(2)}/hr`
        }

        // Filter by budget
        const budgetValue = node.amount?.rawValue ? parseFloat(node.amount.rawValue) : 
                          node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) * 160 : 0
        
        if (budgetValue < preferences.minBudget || budgetValue > preferences.maxBudget) {
          return null
        }

        // Filter by category
        if (preferences.categories?.length > 0 && !preferences.categories.includes(node.category)) {
          return null
        }

        // Filter by client verification
        if (preferences.onlyVerifiedClients && !node.client?.isPaymentVerified) {
          return null
        }

        return {
          id: node.id,
          title: node.title || 'Job Title',
          description: node.description || 'Job description not available',
          budget: budgetText,
          postedDate: new Date(node.createdDateTime || node.publishedDateTime).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }),
          client: {
            name: node.client?.name || 'Upwork Client',
            rating: node.client?.rating || 4.5,
            country: node.client?.country || 'Remote',
            totalSpent: node.client?.totalSpent || 1000,
            totalHires: node.client?.totalHires || 5,
            verified: node.client?.isPaymentVerified || false
          },
          skills: node.skills?.map((s: any) => s.name) || ['General'],
          proposals: node.totalApplicants || 0,
          verified: node.client?.isPaymentVerified || false,
          category: node.category || 'General',
          jobType: node.engagement || node.durationLabel || 'Not specified',
          experienceLevel: node.experienceLevel || 'Not specified',
          source: 'upwork',
          isRealJob: true
        }
      })
      .filter((job: any) => job !== null)

    return {
      success: true,
      jobs: filteredJobs,
      total: totalCount,
      page,
      limit,
      hasMore: (page * limit) < totalCount
    }
    
  } catch (error: any) {
    console.error('Error fetching real jobs:', error)
    return {
      success: false,
      error: error.message,
      jobs: [],
      total: 0
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')

    // Check Upwork connection
    const upworkResult = await pool.query(
      `SELECT access_token FROM upwork_accounts 
       WHERE user_id = $1 AND connection_status = 'connected'`,
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Connect Upwork account to see real jobs',
        upworkConnected: false
      })
    }

    const accessToken = upworkResult.rows[0].access_token
    const result = await fetchRealUpworkJobs(accessToken, page, limit)

    // Store jobs in database for caching
    if (result.success && result.jobs.length > 0) {
      for (const job of result.jobs) {
        try {
          await pool.query(
            `INSERT INTO jobs (
              source_id, title, description, budget_min, budget_max, 
              skills, posted_at, raw_json, fetched_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (source_id) 
            DO UPDATE SET 
              title = $2,
              description = $3,
              fetched_at = NOW()`,
            [
              job.id,
              job.title,
              job.description,
              job.budget?.match(/\$([\d.]+)/)?.[1] || 0,
              job.budget?.match(/\$([\d.]+)-([\d.]+)/)?.[2] || 0,
              job.skills,
              new Date(job.postedDate),
              JSON.stringify(job)
            ]
          )
        } catch (dbError) {
          console.error('Error saving job to DB:', dbError)
        }
      }
    }

    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: Math.ceil(result.total / limit),
      hasMore: result.hasMore,
      message: result.success 
        ? `Found ${result.jobs.length} real jobs from Upwork` 
        : result.error,
      upworkConnected: true
    })
    
  } catch (error: any) {
    console.error('Jobs API error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      error: error.message
    }, { status: 500 })
  }
}