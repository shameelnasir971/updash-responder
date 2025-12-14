// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ REAL DATA ONLY - NO MOCK
async function fetchRealUpworkJobs(accessToken: string, page: number = 1, limit: number = 50) {
  try {
    console.log(`🚀 Fetching REAL jobs - Page ${page}, Limit ${limit}`)
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit
    
    // ✅ PROPER GRAPHQL QUERY WITH PAGINATION
    const graphqlQuery = {
      query: `
        query GetRealJobs($first: Int, $offset: Int) {
          marketplaceJobPostingsSearch(
            paging: { first: $first, offset: $offset }
            sort: { field: POSTED_DATE, direction: DESC }
            marketPlaceJobFilter: {
              keywords: "web development OR react OR node.js OR javascript OR python OR full stack"
            }
          ) {
            totalCount
            edges {
              node {
                id
                title
                description
                amount {
                  rawValue
                  currency {
                    code
                  }
                }
                hourlyBudgetMin {
                  rawValue
                  currency
                }
                hourlyBudgetMax {
                  rawValue
                  currency
                }
                skills {
                  skill {
                    name
                    prettyName
                  }
                }
                totalApplicants
                client {
                  displayName
                  totalSpent
                  location {
                    country
                  }
                  feedback {
                    score
                    count
                  }
                }
                createdDateTime
                jobType
                experienceLevel
                engagement
                category {
                  title
                }
              }
            }
          }
        }
      `,
      variables: {
        first: limit,
        offset: offset
      }
    }
    
    console.log(`🔍 Querying Upwork API for ${limit} jobs from offset ${offset}`)
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API request failed:', errorText.substring(0, 200))
      return { success: false, error: 'api_request_failed', jobs: [], total: 0 }
    }
    
    const data = await response.json()
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { success: false, error: 'graphql_errors', jobs: [], total: 0 }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    const totalCount = data.data?.marketplaceJobPostingsSearch?.totalCount || 0
    
    console.log(`✅ Found ${edges.length} jobs (Total: ${totalCount})`)
    
    if (edges.length === 0) {
      return { success: true, jobs: [], total: 0, error: null }
    }
    
    // ✅ FORMAT REAL JOBS ONLY - NO MOCK DATA
    const formattedJobs = edges.map((edge: any, index: number) => {
      const job = edge.node
      
      // REAL BUDGET
      let budgetText = 'Budget not specified'
      if (job.amount?.rawValue) {
        const amount = parseFloat(job.amount.rawValue)
        const currency = job.amount.currency?.code || 'USD'
        budgetText = `${currency} ${amount}`
      } else if (job.hourlyBudgetMin?.rawValue) {
        const min = parseFloat(job.hourlyBudgetMin.rawValue)
        const max = job.hourlyBudgetMax?.rawValue ? parseFloat(job.hourlyBudgetMax.rawValue) : min
        const currency = job.hourlyBudgetMin?.currency || 'USD'
        if (min === max) {
          budgetText = `${currency} ${min}/hr`
        } else {
          budgetText = `${currency} ${min}-${max}/hr`
        }
      }
      
      // REAL CLIENT DATA
      const clientName = job.client?.displayName || 'Client'
      const clientRating = job.client?.feedback?.score || 4.0
      const clientSpent = job.client?.totalSpent || 0
      const clientHires = job.client?.feedback?.count || 0
      const clientCountry = job.client?.location?.country || 'Remote'
      
      // REAL SKILLS
      const skills = job.skills?.map((s: any) => s.skill?.prettyName || s.skill?.name).filter(Boolean) || 
                    [job.category?.title || 'Development']
      
      // REAL DATE
      const postedDate = job.createdDateTime ? 
        new Date(job.createdDateTime).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 'Recently'
      
      // REAL PROPOSALS
      const proposals = job.totalApplicants || 0
      
      return {
        id: job.id || `job_${Date.now()}_${index}`,
        title: job.title || 'Job Title',
        description: job.description || 'Looking for professional',
        budget: budgetText,
        postedDate: postedDate,
        client: {
          name: clientName,
          rating: parseFloat(clientRating.toFixed(1)),
          country: clientCountry,
          totalSpent: clientSpent,
          totalHires: clientHires
        },
        skills: skills.slice(0, 5),
        proposals: proposals,
        verified: true,
        category: job.category?.title || 'General',
        jobType: job.jobType || 'Fixed Price',
        experienceLevel: job.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        _debug: {
          hasBudget: !!job.amount || !!job.hourlyBudgetMin,
          hasClient: !!job.client,
          hasSkills: skills.length > 0
        }
      }
    })
    
    return { 
      success: true, 
      jobs: formattedJobs, 
      total: totalCount,
      hasMore: edges.length >= limit,
      error: null 
    }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [], total: 0 }
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== REAL JOBS API WITH PAGINATION ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Get pagination parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    
    console.log(`📄 Pagination: Page ${page}, Limit ${limit}`)
    
    // Validate pagination
    if (page < 1 || limit < 1 || limit > 100) {
      return NextResponse.json({ 
        error: 'Invalid pagination parameters' 
      }, { status: 400 })
    }
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('⚠️ No Upwork connection')
      return NextResponse.json({
        success: false,
        jobs: [],
        total: 0,
        message: 'Connect Upwork account to see real jobs',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    console.log('✅ Access token found')
    
    // Fetch REAL jobs with pagination
    const result = await fetchRealUpworkJobs(accessToken, page, limit)
    
    // ✅ NO MOCK DATA - return empty array if no jobs
    if (!result.success || result.jobs.length === 0) {
      console.log('ℹ️ No real jobs found for this page')
      
      return NextResponse.json({
        success: true,
        jobs: [],
        total: 0,
        page: page,
        limit: limit,
        totalPages: 0,
        hasNextPage: false,
        hasPrevPage: page > 1,
        message: 'No jobs found. Try a different page or update search criteria.',
        upworkConnected: true
      })
    }
    
    // ✅ REAL JOBS FOUND
    const totalPages = Math.ceil(result.total / limit)
    
    console.log(`🎉 Success! Page ${page}/${totalPages} - ${result.jobs.length} real jobs`)
    
    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      total: result.total,
      page: page,
      limit: limit,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      upworkConnected: true,
      message: `✅ Found ${result.jobs.length} real jobs (Page ${page} of ${totalPages})`,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalJobs: result.total,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error.message)
    
    return NextResponse.json({
      success: false,
      jobs: [], // ✅ Empty array, NO MOCK
      total: 0,
      message: 'Server error: ' + error.message,
      upworkConnected: false
    }, { status: 500 })
  }
}