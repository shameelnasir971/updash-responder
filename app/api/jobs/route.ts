// app/api/jobs/route.ts - COMPLETE REAL UPDATED
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// ✅ SIMPLE FUNCTION TO FETCH REAL JOBS
async function fetchUpworkJobs(accessToken: string, keywords: string = 'web development') {
  console.log('🔗 Fetching real jobs from Upwork API...')
  
  try {
    const response = await fetch(
      `https://www.upwork.com/api/profiles/v2/search/jobs.json?q=${encodeURIComponent(keywords)}&paging=0;20`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }
    )

    console.log('📡 API Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Upwork API error:', errorText)
      throw new Error(`API error: ${response.status}`)
    }

    const data = await response.json()
    console.log(`✅ API returned ${data.jobs?.length || 0} real jobs`)
    
    return (data.jobs || []).map((job: any) => ({
      id: job.id || `upwork_${Date.now()}`,
      title: job.title || 'Untitled Job',
      description: job.description || 'No description available',
      budget: job.budget ? 
        `$${job.budget.amount} ${job.budget.currency}` : 
        'Rate not specified',
      postedDate: job.created_on ? 
        new Date(job.created_on).toLocaleString() : 
        new Date().toLocaleString(),
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
      category: job.category2 || 'Web Development',
      duration: job.duration || 'Not specified',
      source: 'upwork',
      isRealJob: true,
      isConnectPrompt: false
    }))

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
      return NextResponse.json({ error: 'Please login first' }, { status: 401 })
    }

    console.log('🎯 Fetching jobs for user:', user.email)

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
      
      try {
        // Get user's keywords from prompt settings
        const promptResult = await pool.query(
          'SELECT basic_info FROM prompt_settings WHERE user_id = $1',
          [user.id]
        )
        
        let keywords = 'web development react node javascript'
        if (promptResult.rows.length > 0 && promptResult.rows[0].basic_info?.keywords) {
          keywords = promptResult.rows[0].basic_info.keywords
        }

        jobs = await fetchUpworkJobs(accessToken, keywords)
        source = 'upwork'
        message = `✅ Loaded ${jobs.length} real jobs from Upwork`
        console.log(message)
      } catch (apiError) {
        console.error('❌ Failed to fetch from Upwork:', apiError)
        jobs = [getConnectPromptJob()]
        source = 'api_error'
        message = 'Failed to fetch jobs, but Upwork is connected'
      }
    } else {
      // Upwork not connected - return connection prompt
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
    
    // Return connect prompt on error
    return NextResponse.json({ 
      success: true,
      jobs: [getConnectPromptJob()],
      total: 1,
      source: 'error',
      message: 'Error loading jobs. Connect Upwork account.'
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