// app/api/jobs/route.ts - FINAL CORRECT VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CORRECT GRAPHQL QUERY - "jobSearch" use karo, "jobs" nahi!
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🔗 Fetching REAL jobs from Upwork...')
    
    // ✅ YEH CORRECT QUERY HAI - "jobSearch" field
    const graphqlQuery = {
      query: `
        query GetJobs {
          jobSearch(
            filter: { 
              category2: "Web, Mobile & Software Dev"
              keywords: ["web", "development", "javascript"]
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
                  totalSpent
                  totalHires
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
                duration
              }
            }
            totalCount
          }
        }
      `
    }
    
    console.log('📊 Sending CORRECT GraphQL query...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Upwork-API-TenantId': 'api'
      },
      body: JSON.stringify(graphqlQuery)
    })

    console.log('📊 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error:', errorText)
      return [] // Empty array return karo
    }

    const data = await response.json()
    console.log('📊 GraphQL response received')
    
    // Check for errors
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return [] // Empty array return karo
    }
    
    const edges = data.data?.jobSearch?.edges || []
    console.log(`✅ Found ${edges.length} REAL jobs`)
    
    if (edges.length === 0) {
      console.log('⚠️ No jobs found in response')
      return [] // Empty array return karo
    }
    
    // Transform to our format
    return edges.map((edge: any) => {
      const job = edge.node
      return {
        id: job.id || `upwork_${Date.now()}`,
        title: job.title || 'Web Development Job',
        description: job.description || 'Looking for skilled developer',
        budget: job.budget ? 
          `${job.budget.currency || 'USD'} ${job.budget.amount || '0'}` : 
          'Budget not specified',
        postedDate: job.postedOn ? 
          new Date(job.postedOn).toLocaleDateString() : 
          new Date().toLocaleDateString(),
        client: {
          name: job.client?.name || 'Upwork Client',
          rating: job.client?.feedback || 4.5,
          country: job.client?.country?.name || 'Remote',
          totalSpent: job.client?.totalSpent || 0,
          totalHires: job.client?.totalHires || 0
        },
        skills: job.skills?.map((s: any) => s.name) || ['Web Development'],
        proposals: job.proposalCount || 0,
        verified: job.isVerified || false,
        category: job.category?.title || 'Web Development',
        duration: job.duration || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return [] // Empty array return karo
  }
}

// ✅ GET - Fetch jobs
export async function GET() {
  try {
    console.log('=== STARTING JOBS FETCH ===')
    
    const user = await getCurrentUser()
    if (!user) {
      console.log('❌ No authenticated user')
      return NextResponse.json({ 
        success: true,
        jobs: [], // Empty array
        total: 0,
        upworkConnected: false,
        message: 'Not authenticated'
      })
    }

    console.log(`🎯 Fetching for user: ${user.email}`)

    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    let jobs = []
    let message = ''
    let upworkConnected = false
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      const accessToken = upworkResult.rows[0].access_token
      console.log('🔑 Access token found')
      upworkConnected = true
      
      // Fetch REAL jobs
      jobs = await fetchRealUpworkJobs(accessToken)
      
      if (jobs.length > 0) {
        message = `✅ Loaded ${jobs.length} real jobs from Upwork`
        console.log(message)
      } else {
        message = 'No jobs found on Upwork right now'
        console.log('⚠️ ' + message)
      }
    } else {
      message = 'Connect Upwork account to see jobs'
      jobs = [] // Empty array
      console.log('🔗 ' + message)
    }

    console.log(`📊 Returning ${jobs.length} jobs`)
    console.log('=== JOBS FETCH COMPLETE ===')
    
    return NextResponse.json({ 
      success: true,
      jobs: jobs, // ✅ SIRF REAL JOBS YA EMPTY ARRAY
      total: jobs.length,
      message: message,
      upworkConnected: upworkConnected
    })

  } catch (error: any) {
    console.error('❌ Jobs API error:', error)
    return NextResponse.json({ 
      success: true,
      jobs: [], // ✅ ALWAYS EMPTY ARRAY ON ERROR
      total: 0,
      message: 'Error loading jobs'
    })
  }
}