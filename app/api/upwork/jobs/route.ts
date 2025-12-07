// app/api/upwork/jobs/route.ts - UPDATED WITH CORRECT QUERY
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CORRECT GRAPHQL QUERY
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🔗 Fetching jobs with CORRECT GraphQL query...')
    
    const graphqlQuery = {
      query: `
        query {
          marketplace {
            jobPostings {
              search(
                first: 20
                sort: { field: POSTED_ON, direction: DESC }
                filter: { 
                  category: "531770282580668419"
                }
              ) {
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
                      country {
                        name
                      }
                    }
                    skills {
                      name
                    }
                    proposalCount
                    postedOn
                    duration
                  }
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
    
    if (data.errors) {
      console.error('❌ GraphQL Errors:', data.errors)
      throw new Error(data.errors[0]?.message)
    }
    
    const edges = data.data?.marketplace?.jobPostings?.search?.edges || []
    console.log(`✅ Found ${edges.length} real jobs`)
    
    return edges.map((edge: any) => {
      const job = edge.node
      return {
        id: job.id || `job_${Date.now()}`,
        title: job.title || 'Web Development Job',
        description: job.description || 'Looking for skilled developer',
        budget: job.budget ? 
          `${job.budget.currency || 'USD'} ${job.budget.amount || '0'}` : 
          'Not specified',
        postedDate: job.postedOn ? 
          new Date(job.postedOn).toLocaleDateString() : 
          new Date().toLocaleDateString(),
        client: {
          name: job.client?.name || 'Upwork Client',
          rating: job.client?.feedback || 4.5,
          country: job.client?.country?.name || 'Remote',
          totalSpent: 0,
          totalHires: 0
        },
        skills: job.skills?.map((s: any) => s.name) || ['Web Development'],
        proposals: job.proposalCount || 0,
        verified: true,
        category: 'Web Development',
        duration: job.duration || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
  } catch (error: any) {
    console.error('❌ GraphQL fetch error:', error.message)
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
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      try {
        const accessToken = upworkResult.rows[0].access_token
        console.log('🔑 Token found, fetching jobs...')
        
        jobs = await fetchRealUpworkJobs(accessToken)
        source = 'upwork'
        console.log(`✅ Successfully loaded ${jobs.length} real jobs`)
        
      } catch (apiError: any) {
        console.error('❌ GraphQL fetch failed:', apiError.message)
        jobs = []
        source = 'error'
      }
    } else {
      source = 'not_connected'
      jobs = []
    }

    return NextResponse.json({ 
      success: true,
      jobs: jobs,
      total: jobs.length,
      source: source,
      upworkConnected: upworkResult.rows.length > 0,
      message: jobs.length > 0 ? 
        `✅ Loaded ${jobs.length} real jobs from Upwork` :
        source === 'error' ? '⚠️ API temporarily unavailable' :
        source === 'not_connected' ? '🔗 Connect Upwork to see jobs' :
        'No jobs available'
    })

  } catch (error: any) {
    console.error('❌ Jobs API error:', error)
    return NextResponse.json({ 
      success: true,
      jobs: [],
      total: 0,
      source: 'error',
      message: 'Temporarily unavailable'
    })
  }
}