// app/api/jobs/route.ts - COMPLETE REAL UPDATED
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// REAL UPWORK GRAPHQL API CALL
async function fetchRealUpworkJobs(accessToken: string, keywords: string) {
  console.log('🔗 Fetching real Upwork jobs...')
  
  try {
    // 1. Try Jobs Search API (NEW API)
    const response = await fetch(
      `https://www.upwork.com/api/profiles/v3/search/jobs`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`✅ Received ${data.jobs?.length || 0} jobs`)

    // Transform jobs
    const jobs = (data.jobs || []).slice(0, 20).map((job: any) => ({
      id: job.uid || `job_${Date.now()}_${Math.random()}`,
      title: job.title || 'Upwork Job',
      description: job.description || 'No description available',
      budget: job.budget ? 
        `${job.budget.amount} ${job.budget.currency}` : 
        'Rate not specified',
      postedDate: job.created_on ? 
        new Date(job.created_on).toLocaleDateString() : 
        new Date().toLocaleDateString(),
      client: {
        name: job.client?.name || 'Upwork Client',
        rating: job.client?.feedback || 4.5,
        country: job.client?.country || 'Not specified',
        totalSpent: job.client?.total_spent || 0,
        totalHires: job.client?.total_hires || 0
      },
      skills: job.skills || [],
      proposals: job.candidates || 0,
      verified: job.verified || false,
      category: job.category || 'General',
      duration: job.duration || 'Not specified',
      source: 'upwork',
      isRealJob: true
    }))

    return jobs

  } catch (error: any) {
    console.error('❌ Jobs fetch failed:', error.message)
    
    // 2. FALLBACK: Use GraphQL API
    try {
      return await fetchGraphQLJobs(accessToken)
    } catch (graphqlError) {
      // 3. FALLBACK: Use REST API v2
      try {
        return await fetchRESTJobs(accessToken)
      } catch (restError) {
        throw new Error('All Upwork APIs failed')
      }
    }
  }
}

// ✅ GRAPHQL FALLBACK
async function fetchGraphQLJobs(accessToken: string) {
  console.log('🔄 Trying GraphQL API...')
  
  const query = `
    query {
      jobs(searchParams: { category2: "web-development", paging: { offset: 0, count: 10 } }) {
        jobs {
          uid
          title
          description
          createdOn
          budget {
            amount
            currency
          }
          client {
            uid
            name
            feedback
          }
          skills
        }
      }
    }
  `

  const response = await fetch('https://api.upwork.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query })
  })

  const result = await response.json()
  return (result.data?.jobs?.jobs || []).map((job: any) => ({
    id: job.uid,
    title: job.title,
    description: job.description,
    budget: job.budget ? `${job.budget.amount} ${job.budget.currency}` : 'Not specified',
    postedDate: new Date(job.createdOn).toLocaleDateString(),
    client: { name: job.client?.name || 'Client', rating: 4.5, country: '', totalSpent: 0, totalHires: 0 },
    skills: job.skills || [],
    proposals: 0,
    verified: false,
    isRealJob: true
  }))
}

// ✅ REST API FALLBACK
async function fetchRESTJobs(accessToken: string) {
  console.log('🔄 Trying REST API v2...')
  
  const response = await fetch(
    'https://www.upwork.com/api/profiles/v2/search/jobs.json?q=web+development',
    {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    }
  )

  const data = await response.json()
  return (data.jobs || []).map((job: any) => ({
    id: job.uid || job.id,
    title: job.title,
    description: job.description,
    budget: job.budget ? `${job.budget.amount} ${job.budget.currency}` : 'Not specified',
    postedDate: new Date(job.created_on || Date.now()).toLocaleDateString(),
    client: {
      name: job.client?.name || 'Client',
      rating: job.client?.feedback || 4.5,
      country: job.client?.country || '',
      totalSpent: 0,
      totalHires: 0
    },
    skills: job.skills || [],
    proposals: job.proposals || 0,
    verified: job.verified || false,
    isRealJob: true
  }))
}

// FALLBACK - REST API if GraphQL fails
async function fetchUpworkJobsFallback(accessToken: string, keywords: string) {
  try {
    console.log('🔄 Trying REST API fallback...')
    
    const response = await fetch(
      `https://www.upwork.com/api/profiles/v2/search/jobs.json?q=${encodeURIComponent(keywords)}&paging=0;50`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`REST API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`✅ REST API returned ${data.jobs?.length || 0} jobs`)
    
    return (data.jobs || []).map((job: any) => ({
      id: job.id || `job_${Date.now()}`,
      title: job.title || 'Untitled Job',
      description: job.description || 'No description available',
      budget: job.budget ? 
        `${job.budget.amount} ${job.budget.currency}` : 
        'Rate not specified',
      postedDate: new Date(job.created_on || Date.now()).toLocaleString(),
      client: {
        name: job.client?.name || 'Client',
        rating: job.client?.feedback || 4.5,
        country: job.client?.country || 'Not specified',
        totalSpent: job.client?.total_spent || 0,
        totalHires: job.client?.total_hires || 0
      },
      skills: job.skills || [],
      proposals: job.candidates || 0,
      verified: job.verified || false,
      category: job.category2 || 'Web Development',
      duration: job.duration || 'Ongoing',
      source: 'upwork_rest',
      isRealJob: true
    }))
  } catch (error) {
    console.error('❌ REST API fallback also failed:', error)
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

    console.log('🎯 Fetching REAL Upwork jobs for user:', user.email)

    // Check if user has connected Upwork
    const upworkResult = await pool.query(
      'SELECT access_token, upwork_user_name FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    let jobs = []
    let source = 'error'
    let message = ''
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      // User has connected Upwork - fetch REAL jobs
      const accessToken = upworkResult.rows[0].access_token
      const upworkUserName = upworkResult.rows[0].upwork_user_name || 'User'
      
      // Get user's prompt settings for keywords
      const promptResult = await pool.query(
        'SELECT basic_info FROM prompt_settings WHERE user_id = $1',
        [user.id]
      )
      
      let keywords = 'web development react node javascript'
      if (promptResult.rows.length > 0 && promptResult.rows[0].basic_info?.keywords) {
        keywords = promptResult.rows[0].basic_info.keywords
      }

      try {
        // Try GraphQL API first
        jobs = await fetchRealUpworkJobs(accessToken, keywords)
        source = 'upwork_graphql'
        message = `✅ Loaded ${jobs.length} real jobs from Upwork for ${upworkUserName}`
        console.log(message)
      } catch (graphqlError) {
        console.log('❌ GraphQL failed, trying REST API...')
        try {
          jobs = await fetchUpworkJobsFallback(accessToken, keywords)
          source = 'upwork_rest'
          message = `✅ Loaded ${jobs.length} jobs via REST API`
        } catch (restError) {
          console.error('❌ Both APIs failed:', restError)
          throw new Error('Failed to fetch jobs from Upwork')
        }
      }
    } else {
      // Upwork not connected - return connection prompt
      jobs = [getConnectPromptJob()]
      source = 'not_connected'
      message = '🔗 Connect your Upwork account to see real job listings'
    }

    // Apply filters if any
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const search = searchParams.get('search')

    let filteredJobs = jobs
    
    if (category && category !== 'all' && category !== 'undefined') {
      filteredJobs = filteredJobs.filter((job: any) => 
        job.category?.toLowerCase().includes(category.toLowerCase()) ||
        job.subcategory?.toLowerCase().includes(category.toLowerCase())
      )
    }

    if (search && search.trim()) {
      const searchLower = search.toLowerCase()
      filteredJobs = filteredJobs.filter((job: any) => 
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
      message: message,
      upworkConnected: upworkResult.rows.length > 0
    })

  } catch (error: any) {
    console.error('❌ Jobs API error:', error)
    
    // Return single connect prompt on error
    return NextResponse.json({ 
      success: true,
      jobs: [getConnectPromptJob()],
      total: 1,
      source: 'error',
      message: 'Connect Upwork to view real jobs'
    })
  }
}

// Single connect prompt job
function getConnectPromptJob() {
  return {
    id: "connect_prompt",
    title: "🔗 Connect Your Upwork Account",
    description: "To view real Upwork job listings and send proposals, please connect your Upwork account. Click the 'Connect Upwork' button in the sidebar to get started.",
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