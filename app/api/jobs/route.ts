// app/api/jobs/route.ts - SIMPLIFIED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ✅ SIMPLIFIED: Fetch jobs using Upwork's REST API
async function fetchUpworkJobs(accessToken: string, keywords: string = 'web development') {
  try {
    console.log('🔗 Fetching jobs from Upwork...')
    
    // Use Upwork's job search API
    const response = await fetch(
      `https://www.upwork.com/api/profiles/v3/search/jobs?q=${encodeURIComponent(keywords)}&paging=0;10`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Upwork API error:', response.status, errorText.substring(0, 200))
      throw new Error(`Upwork API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('📊 Upwork API response:', data)

    // Extract jobs from response
    const jobs = data.jobs || data.result?.jobs || []
    console.log(`✅ Found ${jobs.length} jobs from Upwork`)
    
    return jobs.map((job: any, index: number) => ({
      id: job.id || `job_${Date.now()}_${index}`,
      title: job.title || 'Web Development Job',
      description: job.description || job.snippet || 'Looking for a skilled developer',
      budget: job.budget ? 
        `$${job.budget.amount || job.budget} ${job.budget.currency || 'USD'}` : 
        'Hourly rate negotiable',
      postedDate: job.created_on ? 
        new Date(job.created_on).toLocaleDateString() : 
        new Date().toLocaleDateString(),
      client: {
        name: job.client?.name || 'Upwork Client',
        rating: job.client?.feedback || 4.5,
        country: job.client?.country || 'USA',
        totalSpent: job.client?.total_spent || 10000,
        totalHires: job.client?.total_hires || 50
      },
      skills: job.skills || ['JavaScript', 'React', 'Node.js'],
      proposals: job.proposals || job.candidates || 0,
      verified: job.verified || true,
      category: job.category || job.category2 || 'Web Development',
      jobType: job.job_type || 'Hourly',
      duration: job.duration || 'Ongoing',
      source: 'upwork',
      isRealJob: true
    }))

  } catch (error: any) {
    console.error('❌ Jobs fetch error:', error.message)
    return [] // Return empty array on error
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
    let source = 'upwork'
    let message = ''
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      // User has connected Upwork - fetch REAL jobs
      const accessToken = upworkResult.rows[0].access_token
      
      // Get search keywords from URL or use default
      const { searchParams } = new URL(request.url)
      const search = searchParams.get('search') || 'web development'
      
      try {
        jobs = await fetchUpworkJobs(accessToken, search)
        message = `✅ Loaded ${jobs.length} real jobs from Upwork`
        console.log(message)
      } catch (apiError) {
        console.error('❌ Failed to fetch from Upwork:', apiError)
        jobs = [getConnectPromptJob()]
        message = 'Upwork API error - showing connect prompt'
      }
    } else {
      // Upwork not connected - show connect prompt
      jobs = [getConnectPromptJob()]
      source = 'not_connected'
      message = '🔗 Connect your Upwork account to see real job listings'
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
      success: true,
      jobs: [getConnectPromptJob()],
      total: 1,
      source: 'error',
      message: 'Error loading jobs'
    })
  }
}

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