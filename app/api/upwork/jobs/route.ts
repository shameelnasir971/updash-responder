// app/api/upwork/real-jobs/route.ts - NEW FILE
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CORRECT UPWORK GRAPHQL QUERY (jobSearch not jobs)
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🔗 Fetching REAL jobs from Upwork...')
    
    // ✅ CORRECT QUERY - jobSearch use karo
    const query = `
      query {
        jobSearch(
          filter: { 
            category2: "Web, Mobile & Software Dev"
          }
          sort: { field: POSTED_ON, direction: DESC }
          first: 20
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
              isVerified
              category {
                title
              }
              postedOn
            }
          }
          totalCount
        }
      }
    `
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ query })
    })

    console.log('📊 Response status:', response.status)
    
    if (!response.ok) {
      console.error('❌ GraphQL error')
      return []
    }

    const data = await response.json()
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return []
    }
    
    const edges = data.data?.jobSearch?.edges || []
    console.log(`✅ Found ${edges.length} REAL jobs`)
    
    return edges.map((edge: any) => {
      const job = edge.node
      return {
        id: job.id || `job_${Date.now()}`,
        title: job.title || 'Web Development Job',
        description: job.description || '',
        budget: job.budget ? 
          `${job.budget.currency || 'USD'} ${job.budget.amount || '0'}` : 
          'Budget not specified',
        postedDate: job.postedOn ? 
          new Date(job.postedOn).toLocaleDateString() : 
          new Date().toLocaleDateString(),
        client: {
          name: job.client?.name || 'Client',
          rating: job.client?.feedback || 4.5,
          country: job.client?.country?.name || 'Remote',
          totalSpent: 0,
          totalHires: 0
        },
        skills: job.skills?.map((s: any) => s.name) || [],
        proposals: job.proposalCount || 0,
        verified: job.isVerified || false,
        category: job.category?.title || 'Web Development',
        duration: 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return []
  }
}

// GET endpoint
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        success: true,
        jobs: [],
        total: 0,
        message: 'Not authenticated'
      })
    }

    console.log(`🎯 Fetching REAL jobs for: ${user.email}`)

    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    let jobs = []
    let message = ''
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      const accessToken = upworkResult.rows[0].access_token
      console.log('🔑 Access token found')
      
      jobs = await fetchRealUpworkJobs(accessToken)
      
      if (jobs.length > 0) {
        message = `✅ Loaded ${jobs.length} real jobs from Upwork`
      } else {
        message = 'No jobs found on Upwork'
      }
    } else {
      message = 'Connect Upwork account'
      jobs = []
    }

    return NextResponse.json({ 
      success: true,
      jobs: jobs,
      total: jobs.length,
      message: message,
      upworkConnected: upworkResult.rows.length > 0
    })

  } catch (error: any) {
    console.error('❌ Jobs API error:', error)
    return NextResponse.json({ 
      success: true,
      jobs: [],
      total: 0,
      message: 'Error loading jobs'
    })
  }
}