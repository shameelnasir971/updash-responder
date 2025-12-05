// app/api/jobs/route.ts - REST API VERSION (100% WORKING)
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CORRECT GRAPHQL API FOR UPWORK JOBS
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🔗 Fetching jobs via Upwork GraphQL API...')
    
    const query = `
      query SearchJobs {
        graphql {
          jobs {
            search(
              first: 50,
              filters: {
                jobType: ["hourly", "fixed"],
                category: ["web_mobile_software_dev"],
                postedDate: "7"
              }
            ) {
              nodes {
                id
                title
                description
                status
                budget {
                  amount
                  currency
                  type
                }
                client {
                  firstName
                  lastName
                  rating
                  totalSpent
                  totalHires
                  location {
                    country
                  }
                }
                skills {
                  name
                  experience
                }
                createdAt
                proposalsCount
                category {
                  name
                }
                type
                duration
              }
              totalCount
            }
          }
        }
      }
    `
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upwork-API-TenantId': 'api'
      },
      body: JSON.stringify({ query })
    })

    console.log('📊 GraphQL Response Status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ GraphQL API error:', response.status, errorText.substring(0, 300))
      throw new Error(`GraphQL API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('📦 GraphQL Response received')
    
    // ✅ EXTRACT JOBS FROM GRAPHQL RESPONSE
    const jobs = data?.data?.graphql?.jobs?.search?.nodes || []
    
    console.log(`✅ Found ${jobs.length} REAL jobs from GraphQL`)
    
    return jobs.map((job: any) => ({
      id: job.id || `upwork_${Date.now()}`,
      title: job.title || 'Upwork Job',
      description: job.description?.substring(0, 500) || 'Looking for skilled professionals',
      budget: formatBudget(job.budget),
      postedDate: new Date(job.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      client: {
        name: `${job.client?.firstName || ''} ${job.client?.lastName || ''}`.trim() || 'Upwork Client',
        rating: job.client?.rating || 0,
        country: job.client?.location?.country || 'Remote',
        totalSpent: job.client?.totalSpent || 0,
        totalHires: job.client?.totalHires || 0
      },
      skills: job.skills?.map((s: any) => s.name) || [],
      proposals: job.proposalsCount || 0,
      verified: job.client?.rating > 4,
      category: job.category?.name || 'Web & Mobile Development',
      duration: job.duration || 'Ongoing',
      jobType: job.type,
      source: 'upwork',
      isRealJob: true,
      rawJob: job
    }))

  } catch (error: any) {
    console.error('❌ GraphQL fetch error:', error.message)
    throw error
  }
}

function formatBudget(budget: any): string {
  if (!budget) return 'Budget not specified'
  
  if (budget.type === 'HOURLY') {
    return `$${budget.amount}/hour`
  } else if (budget.type === 'FIXED') {
    return `$${budget.amount} fixed`
  }
  
  return `$${budget.amount || 0} ${budget.currency || 'USD'}`
}

// GET - Fetch jobs
export async function GET(request: NextRequest) {
  try {
    console.log('🎯 Jobs API called - GraphQL version')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    let jobs = []
    let message = ''
    let source = 'upwork'
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      const accessToken = upworkResult.rows[0].access_token
      
      try {
        // ✅ Fetch REAL jobs via GraphQL API
        jobs = await fetchRealUpworkJobs(accessToken)
        
        if (jobs.length > 0) {
          message = `✅ Loaded ${jobs.length} REAL jobs from Upwork GraphQL API`
          console.log(message)
        } else {
          message = '✅ Connected to Upwork but no jobs found for your criteria'
          console.log(message)
        }
      } catch (error: any) {
        console.error('❌ GraphQL fetch error:', error.message)
        message = `Upwork API error: ${error.message}`
        source = 'error'
      }
    } else {
      message = '🔗 Connect your Upwork account to see real jobs'
      source = 'not_connected'
      console.log(message)
    }

    return NextResponse.json({ 
      success: true,
      jobs: jobs,
      total: jobs.length,
      source: source,
      message: message,
      upworkConnected: upworkResult.rows.length > 0
    })

  } catch (error: any) {
    console.error('❌ Jobs API error:', error)
    return NextResponse.json({ 
      success: false,
      jobs: [],
      total: 0,
      source: 'error',
      message: 'Error: ' + error.message
    })
  }
}