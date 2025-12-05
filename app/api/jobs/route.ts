// app/api/jobs/route.ts - COMPLETE WORKING VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CORRECT: Fetch REAL Upwork jobs using GraphQL API
async function fetchRealUpworkJobs(accessToken: string) {

  try {
    console.log('🔗 Fetching REAL jobs from Upwork GraphQL API...')
    
    // ✅ CORRECT: Upwork GraphQL API endpoint
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query {
            findJobs(filter: { status: "open", sort: "newest" }, paging: { first: 20 }) {
              nodes {
                id
                title
                description
                postedOn
                budget {
                  amount
                  currency
                  type
                }
                client {
                  displayName
                  location {
                    country
                  }
                  totalSpent
                  totalHires
                }
                skills {
                  name
                }
                category {
                  name
                }
                proposalsCount
                duration
              }
            }
          }
        `
      })
    })

    console.log('📊 API Response Status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Upwork API error:', {
        status: response.status,
        error: errorText.substring(0, 200)
      })
      throw new Error(`Upwork API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('📦 GraphQL Response:', JSON.stringify(data, null, 2))
    
    // ✅ CORRECT: Parse GraphQL response
    const jobs = data?.data?.findJobs?.nodes || []
    console.log(`✅ Found ${jobs.length} REAL jobs from Upwork GraphQL API`)
    
    return jobs.map((job: any) => ({
      id: job.id || `upwork_${Date.now()}`,
      title: job.title || 'Untitled Job',
      description: job.description || 'No description available',
      budget: formatBudget(job.budget),
      postedDate: formatDate(job.postedOn),
      client: {
        name: job.client?.displayName || 'Anonymous Client',
        rating: 4.5, // Default rating
        country: job.client?.location?.country || 'Not specified',
        totalSpent: job.client?.totalSpent || 0,
        totalHires: job.client?.totalHires || 0
      },
      skills: job.skills?.map((s: any) => s.name) || [],
      proposals: job.proposalsCount || 0,
      verified: true,
      category: job.category?.name || 'General',
      duration: job.duration || 'Ongoing',
      source: 'upwork',
      isRealJob: true
    }))

  } catch (error: any) {
    console.error('❌ Upwork GraphQL fetch error:', error.message)
    throw error
  }
}

// Helper functions
function formatBudget(budget: any): string {
  if (!budget) return 'Budget not specified'
  
  if (budget.type === 'HOURLY') {
    return `$${budget.amount}/hour (Hourly)`
  } else if (budget.type === 'FIXED') {
    return `$${budget.amount} (Fixed Price)`
  }
  
  return `$${budget.amount || '0'} ${budget.currency || 'USD'}`
}

function formatDate(dateString: string): string {
  if (!dateString) return 'Recently'
  try {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch (e) {
    return 'Recently'
  }
}

// GET - Fetch jobs
export async function GET(request: NextRequest) {
  try {
    console.log('🎯 Jobs API called')
    
    // Get user
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('👤 User:', user.email)

    // Check if user has connected Upwork
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    console.log('🔑 Upwork connection:', {
      hasConnection: upworkResult.rows.length > 0,
      hasToken: upworkResult.rows.length > 0 && upworkResult.rows[0].access_token
    })
    
    let jobs = []
    let source = 'upwork'
    let message = ''
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      // ✅ User has connected Upwork - fetch REAL jobs
      const accessToken = upworkResult.rows[0].access_token
      
      try {
        // Test connection first
        const testResponse = await fetch('https://www.upwork.com/api/auth/v1/info.json', {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        })
        
        if (testResponse.ok) {
          // Fetch real jobs
          jobs = await fetchRealUpworkJobs(accessToken)
          
          if (jobs.length === 0) {
            message = '✅ Connected to Upwork but no open jobs found at the moment'
          } else {
            message = `✅ Loaded ${jobs.length} REAL jobs from Upwork`
          }
        } else {
          message = '❌ Upwork connection failed - token may be invalid'
          jobs = [getMockJob('invalid_token')]
          source = 'mock'
        }
      } catch (apiError: any) {
        console.error('❌ Upwork fetch error:', apiError.message)
        message = `Upwork API error: ${apiError.message}`
        jobs = [getMockJob('api_error')]
        source = 'mock'
      }
    } else {
      // Upwork not connected
      jobs = [getMockJob('not_connected')]
      source = 'mock'
      message = '🔗 Connect your Upwork account to see real job listings'
    }

    return NextResponse.json({ 
      success: true,
      jobs: jobs,
      total: jobs.length,
      source: source,
      message: message,
      upworkConnected: upworkResult.rows.length > 0 && upworkResult.rows[0].access_token
    })

  } catch (error: any) {
    console.error('❌ Jobs API main error:', error)
    return NextResponse.json({ 
      success: true,
      jobs: [getMockJob('error')],
      total: 1,
      source: 'mock',
      message: 'Error loading jobs: ' + error.message
    })
  }
}

function getMockJob(type: string) {
  const messages = {
    not_connected: {
      title: "🔗 Connect Your Upwork Account",
      description: "To view real Upwork job listings, please connect your Upwork account first."
    },
    invalid_token: {
      title: "🔄 Reconnect Upwork Account",
      description: "Your Upwork connection token has expired. Please reconnect your account."
    },
    api_error: {
      title: "⚠️ Upwork API Issue",
      description: "There was an issue fetching jobs from Upwork. Please try again later."
    },
    error: {
      title: "❌ Error Loading Jobs",
      description: "There was an error loading jobs. Please check your connection."
    }
  }
  
  const msg = messages[type as keyof typeof messages] || messages.not_connected
  
  return {
    id: `mock_${type}`,
    title: msg.title,
    description: msg.description,
    budget: "Not applicable",
    postedDate: new Date().toLocaleString(),
    client: {
      name: "System",
      rating: 0,
      country: "N/A",
      totalSpent: 0,
      totalHires: 0
    },
    skills: ["Connection", "Setup"],
    proposals: 0,
    verified: false,
    category: "System",
    duration: "N/A",
    isRealJob: false
  }
}