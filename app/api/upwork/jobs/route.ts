// app/api/upwork/jobs/route.ts - SIMPLIFIED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ SIMPLE REST API - NO GRAPHQL, NO TENANT ID NEEDED
async function fetchJobsViaRestAPI(accessToken: string) {
  try {
    console.log('🔗 Fetching jobs via REST API...')
    
    // ✅ UPWORK REST ENDPOINT FOR JOBS
    const endpoints = [
      'https://www.upwork.com/api/profiles/v2/jobs/search.json?q=web%20development&page=1&limit=20&sort=relevance',
      'https://api.upwork.com/api/profiles/v2/jobs/search.json?q=javascript&page=1&limit=20&sort=recency',
      'https://www.upwork.com/api/jobs/v2/listings?q=react%20node&page=1&limit=20'
    ]
    
    for (const endpoint of endpoints) {
      try {
        console.log(`📡 Trying REST endpoint: ${endpoint}`)
        
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/json'
          }
        })
        
        console.log(`📥 Response status: ${response.status}`)
        
        if (response.ok) {
          const data = await response.json()
          console.log(`✅ Response structure:`, Object.keys(data))
          
          // Extract jobs from different response formats
          let rawJobs = []
          
          if (data.jobs && Array.isArray(data.jobs)) {
            rawJobs = data.jobs
          } else if (data.profiles && Array.isArray(data.profiles)) {
            rawJobs = data.profiles
          } else if (data.result && data.result.jobs) {
            rawJobs = data.result.jobs
          } else if (Array.isArray(data)) {
            rawJobs = data
          }
          
          console.log(`🎯 Found ${rawJobs.length} raw jobs`)
          
          if (rawJobs.length > 0) {
            // Format jobs for dashboard
            const formattedJobs = rawJobs.slice(0, 20).map((job: any, index: number) => {
              return {
                id: job.id || job.job_id || `job_${Date.now()}_${index}`,
                title: job.title || job.subject || 'Web Development Job',
                description: job.description || job.snippet || 'Looking for skilled developer',
                budget: extractBudget(job),
                postedDate: extractDate(job),
                client: {
                  name: job.client?.name || job.owner?.name || 'Upwork Client',
                  rating: job.client?.feedback || job.client?.rating || 4.0,
                  country: job.client?.country || 'Remote'
                },
                skills: extractSkills(job),
                proposals: job.proposals || job.proposal_count || 0,
                verified: job.verified || false,
                category: job.category?.name || 'Web Development',
                source: 'upwork',
                isRealJob: true
              }
            })
            
            return formattedJobs
          }
        }
      } catch (endpointError) {
        console.log(`❌ Endpoint failed: ${endpoint}`)
        continue
      }
    }
    
    return []
    
  } catch (error: any) {
    console.error('❌ REST API fetch error:', error.message)
    return []
  }
}

// Helper functions
function extractBudget(job: any): string {
  if (job.budget) {
    if (typeof job.budget === 'object') {
      const amount = job.budget.amount || job.budget.minAmount || 0
      const currency = job.budget.currency || job.budget.currencyCode || 'USD'
      return `${currency} ${amount}`
    }
    return `$${job.budget}`
  }
  if (job.amount) {
    return `$${job.amount}`
  }
  return 'Negotiable'
}

function extractDate(job: any): string {
  const date = job.created_on || job.posted_on || job.date || new Date()
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

function extractSkills(job: any): string[] {
  if (job.skills && Array.isArray(job.skills)) {
    return job.skills.slice(0, 5).map((s: any) => s.name || s)
  }
  if (job.required_skills) {
    return job.required_skills.slice(0, 5)
  }
  if (job.categories && Array.isArray(job.categories)) {
    return job.categories.slice(0, 3)
  }
  return ['Web Development']
}

// GET - Fetch jobs
export async function GET() {
  try {
    console.log('=== JOBS API CALLED ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({
        success: true,
        jobs: [],
        total: 0,
        message: 'Please login'
      })
    }
    
    console.log('👤 User:', user.email)
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    let jobs = []
    let message = ''
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      const accessToken = upworkResult.rows[0].access_token
      console.log('✅ Access token found')
      
      jobs = await fetchJobsViaRestAPI(accessToken)
      
      if (jobs.length > 0) {
        message = `✅ Found ${jobs.length} real jobs from Upwork`
        console.log(`🎯 ${jobs.length} real jobs loaded`)
      } else {
        message = 'No active jobs found in your category'
        jobs = []
      }
    } else {
      message = '🔗 Connect Upwork account to see jobs'
      jobs = []
    }
    
    console.log('=== JOBS API COMPLETED ===')
    
    return NextResponse.json({
      success: true,
      jobs: jobs,
      total: jobs.length,
      upworkConnected: upworkResult.rows.length > 0,
      message: message
    })
    
  } catch (error: any) {
    console.error('❌ Jobs API error:', error.message)
    return NextResponse.json({
      success: true,
      jobs: [],
      total: 0,
      message: 'Error loading jobs'
    })
  }
}