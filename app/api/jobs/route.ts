// app/api/jobs/route.ts - SIMPLIFIED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// REAL UPWORK JOBS FETCH FUNCTION
async function fetchRealUpworkJobs(accessToken: string, keywords: string = 'web development') {
  console.log('🔗 Fetching real jobs from Upwork API...')
  
  try {
    // Simple REST API call - GraphQL se easier hai
    const response = await fetch('https://www.upwork.com/api/profiles/v3/search/jobs', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Upwork API error:', errorText)
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`✅ API response received:`, data)
    
    // Transform jobs
    const jobs = (data.jobs || []).map((job: any) => ({
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
      proposals: job.proposals || 0,
      verified: job.verified || false,
      category: job.category || 'Web Development',
      duration: job.duration || 'Ongoing',
      source: 'upwork',
      isRealJob: true
    }))

    return jobs
  } catch (error: any) {
    console.error('❌ Upwork API fetch error:', error.message)
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
      'SELECT access_token, upwork_user_name FROM upwork_accounts WHERE user_id = $1',
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
        // Get keywords from prompt settings
        const promptResult = await pool.query(
          'SELECT basic_info FROM prompt_settings WHERE user_id = $1',
          [user.id]
        )
        
        let keywords = 'web development'
        if (promptResult.rows.length > 0 && promptResult.rows[0].basic_info?.keywords) {
          keywords = promptResult.rows[0].basic_info.keywords
        }

        // Fetch REAL jobs
        jobs = await fetchRealUpworkJobs(accessToken, keywords)
        message = `✅ Loaded ${jobs.length} real jobs from Upwork`
        console.log(message)
      } catch (error) {
        console.error('❌ Failed to fetch from Upwork:', error)
        jobs = [getConnectPromptJob()]
        message = '❌ Failed to load jobs. Please try again.'
      }
    } else {
      // Upwork not connected
      jobs = [getConnectPromptJob()]
      message = '🔗 Connect your Upwork account to see real jobs'
    }

    return NextResponse.json({ 
      success: true,
      jobs: jobs,
      total: jobs.length,
      message: message,
      upworkConnected: upworkConnected
    })

  } catch (error: any) {
    console.error('❌ Jobs API error:', error)
    return NextResponse.json({ 
      success: true,
      jobs: [getConnectPromptJob()],
      total: 1,
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