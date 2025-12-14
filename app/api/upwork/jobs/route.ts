// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchSimpleRealJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching simple REAL jobs...')
    
    // ✅ SIMPLE GraphQL Query - Only fields that DEFINITELY exist
    const graphqlQuery = {
      query: `
        query GetJobs {
          marketplaceJobPostingsSearch {
            edges {
              node {
                id
                title
                description
                amount {
                  displayValue
                }
                skills {
                  name
                }
                totalApplicants
                category
                createdDateTime
                experienceLevel
                engagement {
                  name
                }
                location {
                  country
                }
              }
            }
          }
        }
      `
    }

    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(graphqlQuery)
    })

    console.log('📥 Response status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ API error:', error.substring(0, 200))
      return { success: false, error: `API error ${response.status}`, jobs: [] }
    }

    const data = await response.json()
    
    // ✅ DEBUG: Check what fields we actually get
    console.log('📊 Response sample:', JSON.stringify(data).substring(0, 300))
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { success: false, error: data.errors[0]?.message || 'GraphQL error', jobs: [] }
    }

    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)

    // ✅ Simple Formatting - Only use what Upwork gives us
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // 1. BUDGET - Use displayValue directly
      const budgetText = node.amount?.displayValue || 'Budget not specified'
      
      // 2. POSTED TIME - "X minutes ago" format
      const postedDate = node.createdDateTime
      let postedText = 'Recently'
      if (postedDate) {
        const now = new Date()
        const posted = new Date(postedDate)
        const diffMs = now.getTime() - posted.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        
        if (diffMins < 60) {
          postedText = `${diffMins} minutes ago`
        } else if (diffMins < 1440) {
          postedText = `${Math.floor(diffMins / 60)} hours ago`
        } else {
          postedText = `${Math.floor(diffMins / 1440)} days ago`
        }
      }
      
      // 3. REAL SKILLS from Upwork
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // 4. PROPOSALS COUNT
      const proposals = node.totalApplicants || 0
      let proposalsText = `${proposals}`
      if (proposals <= 5) proposalsText = 'Less than 5'
      else if (proposals <= 10) proposalsText = '5 to 10'
      else if (proposals <= 15) proposalsText = '10 to 15'
      else if (proposals <= 20) proposalsText = '15 to 20'
      else if (proposals <= 50) proposalsText = '20 to 50'
      
      // 5. JOB TYPE STRING (Like Upwork shows)
      let jobTypeString = ''
      if (budgetText.includes('/hr')) {
        jobTypeString = `Hourly: ${budgetText}`
      } else {
        jobTypeString = `Fixed-price: ${budgetText}`
      }
      
      // Add experience level if available
      if (node.experienceLevel) {
        const expLevel = node.experienceLevel.toLowerCase()
        jobTypeString += ` - ${expLevel.charAt(0).toUpperCase() + expLevel.slice(1)}`
      }
      
      // Add duration if available
      if (node.engagement?.name) {
        jobTypeString += ` - Est. time: ${node.engagement.name}`
      }
      
      // 6. RETURN SIMPLE JOB OBJECT
      return {
        id: node.id || `job_${Date.now()}`,
        title: node.title || 'Job Title',
        description: node.description || '',
        budget: budgetText,
        postedText: postedText,
        jobTypeString: jobTypeString,
        
        // ✅ Simple client info - NO MOCK NAMES
        client: {
          name: 'Upwork Client', // Generic name since we don't have client info
          rating: 0.0, // We don't have this from current query
          country: node.location?.country || 'Remote',
          totalSpent: 0, // We don't have this
          totalHires: 0,  // We don't have this
          paymentVerified: false, // We don't have this
        },
        
        skills: realSkills,
        proposals: proposals,
        proposalsText: proposalsText,
        verified: false, // We don't have verification status
        category: node.category || '',
        experienceLevel: node.experienceLevel || '',
        engagement: node.engagement?.name || '',
        source: 'upwork',
        isRealJob: true
      }
    })

    console.log(`✅ Formatted ${jobs.length} REAL jobs`)
    return { success: true, jobs: jobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

export async function GET() {
  try {
    console.log('=== SIMPLE JOBS API ===')

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Invalid access token',
        upworkConnected: false
      })
    }
    
    console.log('🔑 Token available, fetching...')
    const result = await fetchSimpleRealJobs(accessToken)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success ? 
        `✅ SUCCESS: ${result.jobs.length} REAL jobs from Upwork` : 
        `❌ Error: ${result.error}`,
      upworkConnected: true,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message
    }, { status: 500 })
  }
}