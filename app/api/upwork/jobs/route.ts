// app/api/upwork/jobs/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Function to fetch REAL jobs from Upwork
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🔗 Fetching real jobs from Upwork API...')
    
    // CORRECT Upwork API endpoint for job search
    const response = await fetch('https://www.upwork.com/api/profiles/v3/search/jobs', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    console.log('📡 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Upwork API error:', response.status, errorText)
      throw new Error(`Upwork API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('✅ API response received')
    
    // Parse the response
    const jobs = data.jobs || data.profiles || []
    console.log(`✅ Found ${jobs.length} jobs`)
    
    return jobs.map((job: any, index: number) => ({
      id: job.id || job.job_id || `upwork_${Date.now()}_${index}`,
      title: job.title || job.subject || 'Untitled Job',
      description: job.description || job.snippet || 'No description available',
      budget: job.budget ? 
        `$${job.budget.amount || job.budget.min || 100} - $${job.budget.max || 500} ${job.budget.currency || 'USD'}` : 
        'Not specified',
      postedDate: job.created_on ? 
        new Date(job.created_on).toLocaleDateString() : 
        new Date().toLocaleDateString(),
      client: {
        name: job.client?.name || 'Upwork Client',
        rating: job.client?.feedback || 4.5,
        country: job.client?.country || 'International',
        totalSpent: job.client?.total_spent || 0,
        totalHires: job.client?.total_hires || 0
      },
      skills: job.skills || ['General'],
      proposals: job.proposals || 0,
      verified: job.verified || false,
      category: job.category || 'General',
      duration: job.duration || 'Not specified',
      source: 'upwork',
      isRealJob: true
    }))
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    throw error
  }
}

// GET - Fetch jobs
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      console.log('❌ No authenticated user')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    console.log('🎯 Fetching jobs for user:', user.email)

    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    let jobs = []
    let message = ''
    let upworkConnected = false
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      // User has connected Upwork
      upworkConnected = true
      const accessToken = upworkResult.rows[0].access_token
      
      try {
        jobs = await fetchRealUpworkJobs(accessToken)
        message = `✅ Loaded ${jobs.length} real jobs from Upwork`
        console.log(message)
      } catch (error: any) {
        console.error('❌ Failed to fetch from Upwork:', error.message)
        jobs = [getSingleMockJob()]
        message = 'Showing sample job (Upwork API failed)'
      }
    } else {
      // Upwork not connected
      jobs = [getConnectPromptJob()]
      message = '🔗 Connect your Upwork account to see real jobs'
      console.log('ℹ️ Upwork not connected, showing connect prompt')
    }

    return NextResponse.json({ 
      success: true,
      jobs: jobs,
      total: jobs.length,
      message: message,
      upworkConnected: upworkConnected,
      source: upworkConnected ? 'upwork' : 'mock'
    })

  } catch (error: any) {
    console.error('❌ Jobs API error:', error)
    return NextResponse.json({ 
      success: false,
      jobs: [],
      total: 0,
      message: 'Error fetching jobs',
      error: error.message,
      upworkConnected: false
    }, { status: 500 })
  }
}

// Connect prompt job
function getConnectPromptJob() {
  return {
    id: "connect_prompt",
    title: "🔗 Connect Your Upwork Account",
    description: "To view real Upwork job listings, please connect your Upwork account. Click the 'Connect Upwork' button in the sidebar to get started.",
    budget: "Free to connect",
    postedDate: new Date().toLocaleDateString(),
    client: {
      name: "Upwork Platform",
      rating: 5.0,
      country: "Worldwide",
      totalSpent: 0,
      totalHires: 0
    },
    skills: ["Upwork", "Account Setup"],
    proposals: 0,
    verified: true,
    category: "System",
    duration: "Instant",
    isConnectPrompt: true,
    source: "system"
  }
}

// Single mock job
function getSingleMockJob() {
  return {
    id: "mock_job_1",
    title: "Web Developer Needed",
    description: "Looking for a skilled web developer to create a responsive website.",
    budget: "$500 - $1000",
    postedDate: new Date().toLocaleDateString(),
    client: {
      name: "Sample Client",
      rating: 4.5,
      country: "USA",
      totalSpent: 5000,
      totalHires: 10
    },
    skills: ["HTML", "CSS", "JavaScript"],
    proposals: 5,
    verified: true,
    category: "Web Development",
    duration: "1 month",
    source: "mock",
    isRealJob: false
  }
}