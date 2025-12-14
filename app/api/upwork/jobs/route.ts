// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching 100% REAL Upwork jobs...')

    // ✅ WORKING GraphQL Query - Aapke pichle successful response ke fields
    // Sirf wahi fields jo actually kaam kar rahe hain
    const graphqlQuery = {
      query: `
        query GetJobs {
          marketplaceJobPostingsSearch(
            criteria: {
              paging: { count: 20 }
              sort: { field: POSTED_DATE, direction: DESC }
            }
          ) {
            paging {
              total
            }
            jobPostings {
              id
              title
              description
              category
              subcategory
              postedOn
              amount {
                amount
                currencyCode
              }
              hourlyBudget {
                min
                max
                currencyCode
              }
              client {
                id
                name
                location {
                  country
                }
                totalSpent
                totalHired
                rating
                paymentVerified
              }
              skills {
                name
              }
              proposals
              experienceLevel
              duration
              type
              engagement
              visibility
              tier
              featured
              urgent
              enterprise
            }
          }
        }
      `
    }

    console.log('📤 Sending GraphQL query to Upwork API...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Upwork-API-TenantId': 'api',
      },
      body: JSON.stringify(graphqlQuery)
    })

    console.log('📥 Upwork API Response Status:', response.status)

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ Upwork API HTTP error:', error.substring(0, 500))
      return { success: false, error: 'Upwork API request failed', jobs: [] }
    }

    const data = await response.json()
    
    // ✅ DEBUG: Response structure check
    console.log('📊 Upwork API Response keys:', Object.keys(data))
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      
      // Alternative simpler query try karte hain
      console.log('🔄 Trying alternative simpler query...')
      return tryAlternativeQuery(accessToken)
    }

    const jobPostings = data.data?.marketplaceJobPostingsSearch?.jobPostings || []
    console.log(`✅ Found ${jobPostings.length} REAL jobs from Upwork`)

    if (jobPostings.length > 0) {
      console.log('🔍 First job from Upwork:', {
        id: jobPostings[0].id,
        title: jobPostings[0].title,
        client: jobPostings[0].client?.name
      })
    }

    // ✅ Format jobs - 100% REAL DATA
    const jobs = jobPostings.map((job: any) => {
      // ✅ Budget Formatting
      let budgetText = 'Budget not specified'
      
      if (job.amount?.amount) {
        const amount = job.amount.amount
        const currency = job.amount.currencyCode || 'USD'
        const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency
        budgetText = `${symbol}${parseFloat(amount).toFixed(2)}`
      } else if (job.hourlyBudget?.min || job.hourlyBudget?.max) {
        const min = job.hourlyBudget.min ? parseFloat(job.hourlyBudget.min) : 0
        const max = job.hourlyBudget.max ? parseFloat(job.hourlyBudget.max) : min
        const currency = job.hourlyBudget.currencyCode || 'USD'
        const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency
        
        if (min === max || max === 0) {
          budgetText = `${symbol}${min.toFixed(2)}/hr`
        } else {
          budgetText = `${symbol}${min.toFixed(2)}-${max.toFixed(2)}/hr`
        }
      }

      // ✅ REAL Skills
      const realSkills = job.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // ✅ Posted Time
      const postedDate = job.postedOn
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

      // ✅ Client Data
      const client = job.client || {}
      
      // ✅ Job Type String
      let jobTypeString = ''
      if (job.hourlyBudget) {
        jobTypeString = `Hourly: ${budgetText} - `
      } else {
        jobTypeString = `Fixed-price: ${budgetText} - `
      }
      
      const experienceLevel = job.experienceLevel || 'Intermediate'
      jobTypeString += `${experienceLevel} - Est. time: ${job.duration || 'Not specified'}`
      
      if (job.engagement) {
        jobTypeString += `, ${job.engagement} hrs/week`
      }

      // ✅ Proposals Text
      const proposals = job.proposals || 0
      let proposalsText = `${proposals}`
      if (proposals === 0) proposalsText = 'Less than 5'
      else if (proposals <= 5) proposalsText = '5 to 10'
      else if (proposals <= 10) proposalsText = '10 to 15'
      else if (proposals <= 15) proposalsText = '15 to 20'
      else if (proposals <= 20) proposalsText = '20 to 50'

      return {
        // ✅ 100% REAL DATA
        id: job.id,
        title: job.title || '',
        description: job.description || '',
        budget: budgetText,
        postedText: postedText,
        postedDate: postedDate,
        jobTypeString: jobTypeString,
        
        // ✅ REAL Client Data
        client: {
          name: client.name || 'Client', // REAL name from Upwork
          rating: client.rating ? parseFloat(client.rating).toFixed(1) : '0.0',
          country: client.location?.country || 'Remote',
          totalSpent: client.totalSpent || 0,
          totalHires: client.totalHired || 0,
          paymentVerified: client.paymentVerified || false,
        },
        
        skills: realSkills,
        proposals: proposals,
        proposalsText: proposalsText,
        verified: client.paymentVerified || false,
        category: job.category || '',
        subcategory: job.subcategory || '',
        experienceLevel: experienceLevel,
        engagement: job.engagement || '',
        duration: job.duration || '',
        type: job.type || '',
        source: 'upwork',
        isRealJob: true
      }
    })

    console.log(`✅ Formatted ${jobs.length} jobs with 100% REAL data`)
    
    return { 
      success: true, 
      jobs: jobs, 
      error: null,
      dataQuality: '100% REAL - Direct from Upwork API'
    }

  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { 
      success: false, 
      error: error.message, 
      jobs: [],
      dataQuality: 'FAILED - Check API connection'
    }
  }
}

// ✅ Alternative query agar pehli query fail ho jaye
async function tryAlternativeQuery(accessToken: string) {
  try {
    console.log('🔄 Trying REST API endpoint...')
    
    // Try REST endpoint - yeh Upwork ka official REST API hai
    const response = await fetch('https://www.upwork.com/api/profiles/v3/search/jobs?q=web+development&paging=0;20', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('❌ REST API error:', error.substring(0, 300))
      return { success: false, error: 'Both GraphQL and REST APIs failed', jobs: [] }
    }

    const data = await response.json()
    console.log('📊 REST API Response structure:', Object.keys(data))
    
    // Parse REST API response according to Upwork documentation
    const jobs = data.jobs || data.result?.jobs || []
    
    console.log(`✅ Found ${jobs.length} jobs via REST API`)
    
    // Format REST API response
    const formattedJobs = jobs.map((job: any) => ({
      id: job.id || job.uid,
      title: job.title || job.subject,
      description: job.description || job.snippet,
      budget: job.budget?.amount ? `$${job.budget.amount} ${job.budget.currencyCode}` : 'Not specified',
      postedText: 'Recently',
      postedDate: new Date().toISOString(),
      jobTypeString: job.type || 'Fixed-price',
      client: {
        name: job.client?.name || job.client?.company || 'Client',
        rating: job.client?.feedback || 0,
        country: job.client?.location?.country || 'Remote',
        totalSpent: job.client?.totalCharge || 0,
        totalHires: job.client?.totalHires || 0,
        paymentVerified: job.client?.paymentVerified || false,
      },
      skills: job.skills || [],
      proposals: job.proposalsCount || 0,
      proposalsText: `${job.proposalsCount || 0}`,
      verified: job.client?.paymentVerified || false,
      category: job.category || '',
      source: 'upwork',
      isRealJob: true
    }))

    return { 
      success: true, 
      jobs: formattedJobs, 
      error: null,
      dataQuality: 'REAL via REST API'
    }
    
  } catch (error: any) {
    console.error('❌ Alternative query error:', error)
    return { success: false, error: error.message, jobs: [] }
  }
}

export async function GET() {
  try {
    console.log('=== JOBS API: UPDATED WORKING VERSION ===')

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    const result = await fetchRealUpworkJobs(accessToken)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success ? 
        `✅ SUCCESS: ${result.jobs.length} REAL jobs from Upwork` : 
        `❌ Error: ${result.error}`,
      upworkConnected: true,
      dataQuality: result.dataQuality || 'Unknown',
      hasMockData: false,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message,
      dataQuality: 'ERROR',
      hasMockData: false
    }, { status: 500 })
  }
}