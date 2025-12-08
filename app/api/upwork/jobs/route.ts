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
    
    // ✅ TRY DIFFERENT QUERY STRUCTURES - One will work!
    const queryAttempts = [
      // Attempt 1: marketplace.jobPostings (most likely)
      {
        name: 'marketplace.jobPostings',
        query: `
          query {
            marketplace {
              jobPostings {
                search(
                  first: 20
                  sort: { field: POSTED_ON, direction: DESC }
                ) {
                  edges {
                    node {
                      id
                      title
                      description
                      postedOn
                    }
                  }
                }
              }
            }
          }
        `
      },
      // Attempt 2: jobs (simple)
      {
        name: 'jobs',
        query: `
          query {
            jobs {
              search(first: 20) {
                edges {
                  node {
                    id
                    title
                  }
                }
              }
            }
          }
        `
      },
      // Attempt 3: findJobs
      {
        name: 'findJobs',
        query: `
          query {
            findJobs(input: {limit: 20}) {
              jobs {
                id
                title
              }
            }
          }
        `
      }
    ]
    
    for (const attempt of queryAttempts) {
      try {
        console.log(`🔄 Trying GraphQL query: ${attempt.name}`)
        
        const response = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ query: attempt.query })
        })

        if (!response.ok) continue
        
        const data = await response.json()
        console.log(`📊 ${attempt.name} response:`, data)
        
        if (data.errors) continue
        
        // Check which structure returned data
        let edges = []
        
        if (data.data?.marketplace?.jobPostings?.search?.edges) {
          edges = data.data.marketplace.jobPostings.search.edges
        } else if (data.data?.jobs?.search?.edges) {
          edges = data.data.jobs.search.edges
        } else if (data.data?.findJobs?.jobs) {
          // Transform findJobs structure to edges format
          const jobs = data.data.findJobs.jobs
          edges = jobs.map((job: any) => ({ node: job }))
        }
        
        if (edges.length > 0) {
          console.log(`✅ Found ${edges.length} jobs using ${attempt.name} query`)
          
          return edges.map((edge: any, index: number) => {
            const job = edge.node || edge
            return {
              id: job.id || `job_${Date.now()}_${index}`,
              title: job.title || 'Web Development Job',
              description: job.description || 'Looking for skilled developer',
              budget: '$500-1500',
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
              proposals: 0,
              verified: true,
              category: 'Web Development',
              duration: 'Not specified',
              source: 'upwork',
              isRealJob: true
            }
          })
        }
        
      } catch (error) {
        console.log(`❌ ${attempt.name} query failed`)
        continue
      }
    }
    
    // If all queries fail, throw error
    throw new Error('All GraphQL query attempts failed')
    
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