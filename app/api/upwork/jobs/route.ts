// app/api/upwork/jobs/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// REAL UPWORK API JOBS FETCH
async function fetchRealUpworkJobs(accessToken: string, id: any) {
  try {
    console.log('🔗 CORRECT Upwork API call...')
    
    // ✅ CORRECT ENDPOINT for GraphQL API
    const graphqlQuery = `
      query GetJobs {
        jobs {
          search(
            first: 50
            sort: "POSTED_DATE_DESC"
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
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        query: graphqlQuery
      })
    })

    console.log('📊 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API Error:', errorText)
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('✅ GraphQL Response:', data)
    
    // Transform GraphQL response to our format
    const jobs = data.data?.jobs?.search?.edges || []
    
    return jobs.map((edge: any) => {
      const job = edge.node
      return {
        id: job.id,
        title: job.title || 'Untitled Job',
        description: job.description || '',
        budget: job.budget ? 
          `${job.budget.currency} ${job.budget.amount}` : 
          'Not specified',
        postedDate: job.postedOn ? 
          new Date(job.postedOn).toLocaleString() : 
          'Recently',
        client: {
          name: job.client?.name || 'Unknown Client',
          rating: job.client?.feedback || 0,
          country: job.client?.country || 'Not specified',
          totalSpent: job.client?.totalSpent || 0,
          totalHires: job.client?.totalHires || 0
        },
        skills: job.skills?.map((s: any) => s.name) || [],
        proposals: job.proposals || 0,
        verified: job.verified || false,
        category: job.category?.name || 'General',
        duration: job.duration || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
  } catch (error: any) {
    console.error('❌ Upwork GraphQL error:', error.message)
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
      // Fetch REAL JOBS from Upwork
      try {
        const accessToken = upworkResult.rows[0].access_token
        jobs = await fetchRealUpworkJobs(accessToken, user.id)
        source = 'upwork'
        console.log(`✅ Loaded ${jobs.length} real jobs from Upwork`)
      } catch (apiError) {
        console.error('❌ Failed to fetch from Upwork, using single mock job')
        // Single mock job fallback
        jobs = [getSingleMockJob()]
        source = 'mock_fallback'
      }
    } else {
      // Upwork not connected - single mock job
      jobs = [getSingleMockJob()]
      source = 'mock_not_connected'
      console.log('ℹ️ Upwork not connected, showing connect prompt')
    }

    // Get URL parameters for filtering
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    // Apply filters
    let filteredJobs = jobs
    if (category && category !== 'all') {
      filteredJobs = filteredJobs.filter((job: { category: string; }) => 
        job.category?.toLowerCase().includes(category.toLowerCase())
      )
    }

    if (search) {
      const searchLower = search.toLowerCase()
      filteredJobs = filteredJobs.filter((job: { title: string; description: string; skills: string[]; }) => 
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
      )
    }

    return NextResponse.json({ 
      success: true,
      jobs: filteredJobs,
      total: filteredJobs.length,
      source: source,
      upworkConnected: upworkResult.rows.length > 0,
      message: source === 'upwork' ? 
        `🎯 Loaded ${filteredJobs.length} real jobs from Upwork` :
        '🔗 Connect Upwork to see real jobs'
    })

  } catch (error: any) {
    console.error('❌ Jobs API error:', error)
    return NextResponse.json({ 
      success: true,
      jobs: [getSingleMockJob()],
      total: 1,
      source: 'error_fallback',
      error: error.message,
      message: '❌ Error loading jobs - Connect Upwork account'
    })
  }
}

// Single mock job (only for fallback)
function getSingleMockJob() {
  return {
    id: "upwork_connect_prompt",
    title: "🔗 Connect Your Upwork Account",
    description: "To see real job listings, please connect your Upwork account. Click the 'Connect Upwork' button in the sidebar to get started.",
    budget: "Free to connect",
    postedDate: new Date().toLocaleString(),
    client: {
      name: "Upwork Platform",
      rating: 5.0,
      country: "Worldwide",
      totalSpent: 0,
      totalHires: 0
    },
    skills: ["Upwork", "Account Setup", "API Connection"],
    proposals: 0,
    verified: true,
    category: "System",
    duration: "Instant",
    isConnectPrompt: true
  }
}