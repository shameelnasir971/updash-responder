// app/api/jobs/route.ts - SIMPLE REST VERSION

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ SIMPLE REST API CALL (r_jobs scope compatible)
async function fetchUpworkJobsREST(accessToken: string) {
  try {
    console.log('🔗 Fetching jobs via REST API (r_jobs scope)...')
    
    // ✅ Correct REST endpoint for job search
    const response = await fetch('https://www.upwork.com/api/profiles/v2/jobs/search.json?q=web+development&paging=0;50', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    console.log('📊 REST API Status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ REST API error:', response.status, errorText.substring(0, 200))
      throw new Error(`REST API error: ${response.status}`)
    }

    const data = await response.json()
    console.log('📦 REST API Response keys:', Object.keys(data))
    
    // Extract jobs from response
    let jobs = []
    
    if (data.jobs && Array.isArray(data.jobs)) {
      jobs = data.jobs
      console.log(`✅ Found ${jobs.length} jobs in 'jobs' array`)
    } else if (data.profiles && Array.isArray(data.profiles)) {
      jobs = data.profiles
      console.log(`✅ Found ${jobs.length} jobs in 'profiles' array`)
    } else if (data.result) {
      jobs = data.result.jobs || data.result.profiles || []
      console.log(`✅ Found ${jobs.length} jobs in 'result'`)
    }
    
    console.log(`✅ Total jobs found: ${jobs.length}`)
    
    return jobs.map((job: any, index: number) => ({
      id: job.id || job.ciphertext || `upwork_${Date.now()}_${index}`,
      title: job.title || job.subject || 'Web Development Job',
      description: job.description || job.snippet || 'Looking for web developer',
      budget: extractBudget(job),
      postedDate: extractDate(job),
      client: {
        name: job.client?.name || job.client?.company_name || 'Upwork Client',
        rating: job.client?.rating || job.client?.feedback || 0,
        country: job.client?.country || job.client?.location || 'Remote',
        totalSpent: job.client?.total_spent || job.client?.totalCharge || 0,
        totalHires: job.client?.total_hires || job.client?.totalJobs || 0
      },
      skills: extractSkills(job),
      proposals: job.proposals || job.candidates || 0,
      verified: job.verified || false,
      category: job.category || job.category2 || 'Web Development',
      duration: job.duration || job.job_type || 'Not specified',
      source: 'upwork',
      isRealJob: true,
      rawData: job
    }))

  } catch (error: any) {
    console.error('❌ REST fetch error:', error.message)
    throw error
  }
}

function extractBudget(job: any): string {
  if (job.budget) {
    if (typeof job.budget === 'object') {
      const amount = job.budget.amount || job.budget.min || 0
      const max = job.budget.max || amount
      const currency = job.budget.currency || 'USD'
      return `$${amount}-${max} ${currency}`
    }
    return `$${job.budget} USD`
  }
  
  if (job.hourly_rate) {
    return `$${job.hourly_rate}/hour`
  }
  
  return 'Budget not specified'
}

function extractDate(job: any): string {
  const dateStr = job.created_on || job.posted_on || job.date
  if (dateStr) {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return 'Recently'
    }
  }
  return 'Recently'
}

function extractSkills(job: any): string[] {
  if (job.skills && Array.isArray(job.skills)) {
    return job.skills.slice(0, 5)
  }
  
  if (job.job_category && Array.isArray(job.job_category)) {
    return job.job_category.slice(0, 5)
  }
  
  return ['Web Development', 'JavaScript']
}

// GET - Fetch jobs
export async function GET(request: NextRequest) {
  try {
    console.log('🎯 Jobs API called - REST version')
    
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
        // ✅ Fetch jobs via REST API
        jobs = await fetchUpworkJobsREST(accessToken)
        
        if (jobs.length > 0) {
          message = `✅ Loaded ${jobs.length} REAL jobs from Upwork REST API`
          console.log(message)
        } else {
          message = '✅ Connected but no jobs found'
          console.log(message)
        }
      } catch (error: any) {
        console.error('❌ REST API error:', error.message)
        message = `Error: ${error.message}`
        source = 'error'
      }
    } else {
      message = '🔗 Connect Upwork to see real jobs'
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