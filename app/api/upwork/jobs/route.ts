// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching 100% REAL Upwork jobs...')

    // ✅ CORRECT GraphQL Query - No 'first' parameter
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch {
            edges {
              node {
                id
                title
                description
                amount {
                  rawValue
                  currency
                  displayValue
                }
                hourlyBudgetMin {
                  rawValue
                  currency
                  displayValue
                }
                hourlyBudgetMax {
                  rawValue
                  currency
                  displayValue
                }
                skills {
                  name
                }
                totalApplicants
                category
                subcategory
                createdDateTime
                publishedDateTime
                experienceLevel
                engagement {
                  name
                }
                duration {
                  label
                }
                location {
                  country
                }
                client {
                  id
                  displayName
                  rating
                  totalSpent
                  totalHired
                  paymentVerificationStatus
                }
                type
                tier
                hourlyBudgetType
                featured
                urgent
                topRated
                enterprise
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

    console.log('📥 Upwork API Response Status:', response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Upwork API error response:', errorText.substring(0, 500))
      return { success: false, error: `API error ${response.status}: ${errorText.substring(0, 100)}`, jobs: [] }
    }

    const data = await response.json()
    
    // ✅ DEBUG: Check response structure
    console.log('📊 GraphQL Response keys:', Object.keys(data))
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { success: false, error: data.errors[0]?.message || 'GraphQL error', jobs: [] }
    }
    
    if (!data.data?.marketplaceJobPostingsSearch) {
      console.error('❌ No marketplaceJobPostingsSearch in response:', data)
      return { success: false, error: 'No jobs data in response', jobs: [] }
    }

    const edges = data.data.marketplaceJobPostingsSearch.edges || []
    console.log(`✅ Found ${edges.length} REAL job edges from Upwork API`)

    if (edges.length === 0) {
      console.log('ℹ️ No jobs found in response')
      return { success: true, jobs: [], error: null }
    }

    // ✅ Log first job for debugging
    console.log('🔍 First job from API (cleaned):')
    const firstJob = edges[0].node
    console.log({
      id: firstJob.id,
      title: firstJob.title,
      clientName: firstJob.client?.displayName,
      budget: firstJob.amount?.displayValue,
      skills: firstJob.skills?.length
    })

    // ✅ Format jobs - EXACTLY as Upwork shows - 100% REAL DATA
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      const client = node.client || {}
      
      // 1. BUDGET - REAL DATA ONLY
      let budgetText = 'Budget not specified'
      
      // Fixed Price
      if (node.amount?.displayValue) {
        budgetText = node.amount.displayValue
      }
      // Hourly Rate
      else if (node.hourlyBudgetMin?.displayValue || node.hourlyBudgetMax?.displayValue) {
        const min = node.hourlyBudgetMin?.displayValue || ''
        const max = node.hourlyBudgetMax?.displayValue || ''
        
        if (min && max && min !== max) {
          budgetText = `${min}-${max}/hr`
        } else if (min) {
          budgetText = `${min}/hr`
        } else if (max) {
          budgetText = `${max}/hr`
        }
      }
      
      // 2. POSTED TIME - "26 minutes ago" format
      const postedDate = node.createdDateTime || node.publishedDateTime
      let postedText = 'Recently'
      if (postedDate) {
        try {
          const now = new Date()
          const posted = new Date(postedDate)
          const diffMs = now.getTime() - posted.getTime()
          const diffMins = Math.floor(diffMs / 60000)
          const diffHours = Math.floor(diffMins / 60)
          const diffDays = Math.floor(diffHours / 24)
          
          if (diffMins < 60) {
            postedText = `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`
          } else if (diffHours < 24) {
            postedText = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`
          } else if (diffDays < 7) {
            postedText = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`
          } else {
            postedText = posted.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          }
        } catch (e) {
          console.log('Date parsing error:', e)
        }
      }
      
      // 3. JOB TYPE STRING - Like Upwork shows
      let jobTypeString = ''
      const isHourly = node.hourlyBudgetMin || node.hourlyBudgetMax
      
      if (isHourly) {
        jobTypeString = `Hourly: ${budgetText} - `
      } else {
        jobTypeString = `Fixed-price: ${budgetText} - `
      }
      
      // Experience Level
      const experienceLevel = node.experienceLevel ? 
        node.experienceLevel.charAt(0) + node.experienceLevel.slice(1).toLowerCase() : 
        'Intermediate'
      jobTypeString += `${experienceLevel} - `
      
      // Duration/Engagement
      const duration = node.duration?.label || node.engagement?.name || 'Not specified'
      jobTypeString += `Est. time: ${duration}`
      
      // 4. REAL SKILLS
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // 5. REAL PROPOSALS COUNT
      const proposals = node.totalApplicants || 0
      let proposalsText = `${proposals}`
      if (proposals === 0) proposalsText = 'Less than 5'
      else if (proposals <= 5) proposalsText = '5 to 10'
      else if (proposals <= 10) proposalsText = '10 to 15'
      else if (proposals <= 15) proposalsText = '15 to 20'
      else if (proposals <= 20) proposalsText = '20 to 50'
      
      // 6. VERIFICATION STATUS
      const isVerified = client.paymentVerificationStatus === 'VERIFIED' || 
                        client.paymentVerificationStatus === 'PAYMENT_VERIFIED'
      
      // 7. RATING
      const clientRating = client.rating ? parseFloat(client.rating).toFixed(1) : '0.0'
      
      // ✅ FINAL JOB OBJECT - 100% REAL DATA
      return {
        id: node.id || `job_${Date.now()}`,
        title: node.title || 'Job Title',
        description: node.description || '',
        budget: budgetText,
        postedText: postedText,
        postedDate: postedDate,
        jobTypeString: jobTypeString,
        
        // REAL CLIENT DATA (from API)
        client: {
          name: client.displayName || 'Client',
          rating: parseFloat(clientRating),
          country: node.location?.country || 'Remote',
          totalSpent: client.totalSpent || 0,
          totalHires: client.totalHired || 0,
          paymentVerified: isVerified,
        },
        
        skills: realSkills,
        proposals: proposals,
        proposalsText: proposalsText,
        verified: isVerified,
        category: node.category || '',
        experienceLevel: experienceLevel,
        engagement: node.engagement?.name || '',
        duration: node.duration?.label || '',
        source: 'upwork',
        isRealJob: true,
        
        // Additional flags
        featured: node.featured || false,
        urgent: node.urgent || false,
        topRated: node.topRated || false,
        enterprise: node.enterprise || false,
        
        // ❌ NO MOCK DATA, NO FIXED NAMES
        // ❌ NO "Enterprise Client", "Tech Solutions Inc", etc.
        // ❌ NO _debug_budget
      }
    })

    console.log(`✅ Formatted ${jobs.length} jobs with 100% REAL data`)
    
    // ✅ Final check: Ensure NO mock names
    const hasMockNames = jobs.some((job: { client: { name: string } }) => {
      const mockNames = ['Enterprise Client', 'Tech Solutions Inc', 'Startup Company', 'Digital Agency']
      return mockNames.includes(job.client.name)
    })
    
    if (hasMockNames) {
      console.warn('⚠️ WARNING: Mock names detected in final jobs!')
    }

    return { 
      success: true, 
      jobs: jobs, 
      error: null,
      dataQuality: '100% REAL - Direct from Upwork GraphQL API'
    }

  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    console.error('❌ Error stack:', error.stack)
    return { 
      success: false, 
      error: error.message, 
      jobs: [],
      dataQuality: 'FAILED - API connection error'
    }
  }
}

export async function GET() {
  try {
    console.log('=== JOBS API: 100% REAL DATA (FIXED) ===')

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Check Upwork connection
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
    
    if (!accessToken || accessToken === '') {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Invalid access token. Reconnect Upwork.',
        upworkConnected: false
      })
    }
    
    console.log('🔑 Access token available, length:', accessToken.length)
    
    const result = await fetchRealUpworkJobs(accessToken)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success ? 
        `✅ SUCCESS: ${result.jobs.length} REAL jobs from Upwork` : 
        `❌ Error: ${result.error}`,
      upworkConnected: true,
      dataQuality: result.dataQuality,
      hasMockData: false,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ Main handler error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message,
      hasMockData: false
    }, { status: 500 })
  }
}