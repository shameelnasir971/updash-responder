// app/api/upwork/jobs/route.ts - CORRECTED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// REAL UPWORK GRAPHQL JOBS FETCH
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🔗 Fetching real jobs from Upwork GraphQL...')
    
    // ✅ CORRECT GRAPHQL QUERY
    const graphqlQuery = {
      query: `
        query GetJobs {
          jobs {
            search(
              first: 20
              sort: POSTED_DATE_DESC
            ) {
              totalCount
              edges {
                node {
                  id
                  title
                  description
                  budget {
                    amount
                    currency
                  }
                  client {
                    name
                    feedback
                    country
                    totalSpent
                    totalHires
                  }
                  skills {
                    name
                  }
                  proposals
                  verified
                  category {
                    name
                  }
                  postedOn
                  duration
                }
              }
            }
          }
        }
      `
    }
    
    console.log('📊 Sending GraphQL query...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })

    console.log('📊 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error:', errorText)
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('📊 GraphQL Response:', JSON.stringify(data, null, 2))
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('❌ GraphQL Errors:', data.errors)
      throw new Error(`GraphQL error: ${data.errors[0]?.message}`)
    }
    
    // Transform GraphQL response
    const jobs = data.data?.jobs?.search?.edges || []
    console.log(`✅ Found ${jobs.length} jobs in GraphQL response`)
    
    return jobs.map((edge: any) => {
      const job = edge.node
      return {
        id: job.id || `job_${Date.now()}`,
        title: job.title || 'Untitled Job',
        description: job.description || '',
        budget: job.budget ? 
          `${job.budget.currency || 'USD'} ${job.budget.amount || '0'}` : 
          'Not specified',
        postedDate: job.postedOn ? 
          new Date(job.postedOn).toLocaleString() : 
          'Recently',
        client: {
          name: job.client?.name || 'Unknown Client',
          rating: job.client?.feedback || 0,
          country: job.client?.country || 'Remote',
          totalSpent: job.client?.totalSpent || 0,
          totalHires: job.client?.totalHires || 0
        },
        skills: job.skills?.map((s: any) => s.name) || ['General'],
        proposals: job.proposals || 0,
        verified: job.verified || false,
        category: job.category?.name || 'General',
        duration: job.duration || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
  } catch (error: any) {
    console.error('❌ Upwork GraphQL fetch error:', error.message)
    console.error('❌ Error stack:', error.stack)
    throw error
  }
}

// GET - Fetch jobs
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('🎯 Fetching jobs for user:', user.email)

    // Check if user has connected Upwork
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    let jobs = []
    let source = 'none'
    let errorMessage = ''
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      // Fetch REAL JOBS from Upwork
      try {
        const accessToken = upworkResult.rows[0].access_token
        console.log('🔑 Access token found:', accessToken.substring(0, 30) + '...')
        
        jobs = await fetchRealUpworkJobs(accessToken)
        source = 'upwork'
        console.log(`✅ Successfully loaded ${jobs.length} real jobs from Upwork`)
      } catch (apiError: any) {
        console.error('❌ Failed to fetch from Upwork:', apiError.message)
        errorMessage = apiError.message
        source = 'error'
      }
    } else {
      // Upwork not connected
      source = 'not_connected'
      console.log('ℹ️ Upwork not connected')
    }

    // Agar jobs nahi milay, to empty array return karo (NO MOCK JOBS)
    if (jobs.length === 0) {
      console.log('⚠️ No jobs found, returning empty array')
    }

    return NextResponse.json({ 
      success: true,
      jobs: jobs, // Real jobs ya empty array
      total: jobs.length,
      source: source,
      upworkConnected: upworkResult.rows.length > 0,
      error: errorMessage,
      message: source === 'upwork' ? 
        `✅ Loaded ${jobs.length} real jobs from Upwork` :
        source === 'error' ? `❌ Error: ${errorMessage}` :
        '🔗 Connect Upwork to see real jobs'
    })

  } catch (error: any) {
    console.error('❌ Jobs API error:', error)
    return NextResponse.json({ 
      success: false,
      jobs: [], // ❌ NO MOCK JOBS - empty array
      total: 0,
      source: 'error',
      error: error.message,
      message: '❌ Error loading jobs'
    }, { status: 500 })
  }
}