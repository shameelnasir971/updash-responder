// app/api/jobs/route.ts - COMPLETE FIXED CODE
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Function to fetch real Upwork jobs
async function fetchUpworkJobs(accessToken: string) {
  console.log('🔄 Fetching jobs from Upwork API...')
  
  try {
    // Upwork Search Jobs API endpoint
    const response = await fetch(
      'https://www.upwork.com/api/profiles/v2/search/jobs.json?q=web+development&paging=0;50',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`Upwork API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`✅ Received ${data.jobs?.length || 0} jobs from Upwork`)
    
    // Transform to our format
    return (data.jobs || []).map((job: any) => ({
      id: job.id || `job_${Date.now()}`,
      title: job.title || 'Untitled Job',
      description: job.description || 'No description available',
      budget: job.budget ? 
        `${job.budget.amount} ${job.budget.currency}` : 
        'Rate not specified',
      postedDate: new Date(job.created_on || Date.now()).toLocaleDateString(),
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
      duration: job.duration || 'Ongoing'
    }))
  } catch (error) {
    console.error('❌ Upwork API error:', error)
    throw error
  }
}

// Main GET function
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log(`🎯 Fetching jobs for: ${user.email}`)

    // Check Upwork connection
    const upworkResult = await pool.query(
      `SELECT access_token FROM upwork_accounts WHERE user_id = $1`,
      [user.id]
    )

    let jobs = []
    let source = 'upwork'
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      try {
        // Fetch real Upwork jobs
        jobs = await fetchUpworkJobs(upworkResult.rows[0].access_token)
        
        if (jobs.length === 0) {
          // If no jobs returned, show single prompt
          jobs = [getConnectPromptJob()]
          source = 'upwork_no_jobs'
        }
      } catch (error) {
        console.error('❌ Failed to fetch Upwork jobs:', error)
        jobs = [getConnectPromptJob()]
        source = 'upwork_error'
      }
    } else {
      // Not connected to Upwork
      jobs = [getConnectPromptJob()]
      source = 'not_connected'
    }

    // Get filters
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

    if (search && search.trim()) {
      const searchLower = search.toLowerCase()
      filteredJobs = filteredJobs.filter((job: { title: string; description: string; skills: string[]; }) =>
        job.title.toLowerCase().includes(searchLower) ||
        job.description.toLowerCase().includes(searchLower) ||
        job.skills.some((skill: string) => skill.toLowerCase().includes(searchLower))
      )
    }

    console.log(`✅ Returning ${filteredJobs.length} jobs (source: ${source})`)
    
    return NextResponse.json({
      success: true,
      jobs: filteredJobs,
      total: filteredJobs.length,
      source: source,
      upworkConnected: upworkResult.rows.length > 0,
      message: source === 'upwork' ? 
        `🎯 Found ${filteredJobs.length} matching jobs` :
        '🔗 Connect your Upwork account to see real job listings'
    })

  } catch (error: any) {
    console.error('❌ Jobs API error:', error)
    
    return NextResponse.json({
      success: true,
      jobs: [getConnectPromptJob()],
      total: 1,
      source: 'error',
      message: 'Connect Upwork to view jobs'
    })
  }
}

// Single prompt job (when not connected)
function getConnectPromptJob() {
  return {
    id: "connect_prompt",
    title: "🔗 Connect Your Upwork Account",
    description: "To view real Upwork job listings and send proposals, please connect your Upwork account. Click the 'Connect Upwork' button in the sidebar.",
    budget: "Connect to view",
    postedDate: new Date().toLocaleDateString(),
    client: {
      name: "Upwork Platform",
      rating: 5.0,
      country: "Global",
      totalSpent: 0,
      totalHires: 0
    },
    skills: ["Account Setup", "API Integration", "Upwork"],
    proposals: 0,
    verified: true,
    category: "System",
    duration: "Instant",
    isConnectPrompt: true
  }
}