// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching PURE REAL Upwork jobs - NO MOCK DATA...')
    
    // ✅ REAL Upwork GraphQL Query (client details included)
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch(
            first: 20
            filters: {
              category: ["Web, Mobile & Software Dev", "Design & Creative", "Admin Support"]
              engagement: FIXED_PRICE
            }
          ) {
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
                  id
                }
                totalApplicants
                category
                createdDateTime
                publishedDateTime
                experienceLevel
                engagement
                duration
                durationLabel
                # ✅ REAL CLIENT DATA - Attempt to fetch
                client {
                  id
                  name
                  rating
                  location {
                    country
                    city
                  }
                  stats {
                    totalSpent
                    totalHired
                    totalJobsPosted
                  }
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
        'User-Agent': 'UpworkAssistant/1.0'
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API error response:', errorText.substring(0, 500))
      return { success: false, error: `API request failed: ${response.status}`, jobs: [] }
    }
    
    const data = await response.json()
    
    // ✅ Debug log for API response structure
    console.log('📊 API Response keys:', Object.keys(data))
    if (data.data?.marketplaceJobPostingsSearch?.edges?.[0]?.node) {
      const firstJob = data.data.marketplaceJobPostingsSearch.edges[0].node
      console.log('🔍 First job sample:', {
        id: firstJob.id,
        title: firstJob.title?.substring(0, 50),
        hasClient: !!firstJob.client,
        clientData: firstJob.client || 'NO CLIENT DATA'
      })
    }
    
    if (data.errors) {
      console.error('GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { success: false, error: data.errors[0]?.message || 'GraphQL error', jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} REAL job edges from Upwork API`)
    
    // ✅ Format jobs - ONLY REAL DATA, NO MOCK
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      const clientData = node.client || {}
      const clientStats = clientData.stats || {}
      
      // ✅ 1. BUDGET FORMATTING (Real)
      let budgetText = 'Budget not specified'
      if (node.amount?.displayValue) {
        budgetText = node.amount.displayValue
      } else if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        budgetText = currency === 'USD' ? `$${rawValue.toFixed(2)}` : `${rawValue.toFixed(2)} ${currency}`
      } else if (node.hourlyBudgetMin?.rawValue) {
        const min = parseFloat(node.hourlyBudgetMin.rawValue)
        const max = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : min
        const currency = node.hourlyBudgetMin.currency || 'USD'
        const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency + ' '
        budgetText = min === max ? `${symbol}${min}/hr` : `${symbol}${min}-${max}/hr`
      }
      
      // ✅ 2. CLIENT DATA (ONLY Real - if not available, use minimal placeholders)
      const clientInfo = {
        name: clientData.name || 'Client Name Not Available', // No fake names
        rating: clientData.rating || 0, // Zero if no rating
        country: clientData.location?.country || 'Location Not Available',
        totalSpent: clientStats.totalSpent || 0,
        totalHires: clientStats.totalHired || 0,
        isRealData: !!clientData.id // Flag to show if real data exists
      }
      
      // ✅ 3. SKILLS (Real)
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // ✅ 4. DATES (Real)
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 'Date not available'
      
      // ✅ 5. OTHER FIELDS (Real)
      return {
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || 'No description available',
        budget: budgetText,
        postedDate: formattedDate,
        client: clientInfo, // ✅ REAL/MINIMAL DATA ONLY
        skills: realSkills.slice(0, 5),
        proposals: node.totalApplicants || 0,
        verified: true, // Upwork se check karein agar available ho
        category: node.category || 'General',
        jobType: node.engagement || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        hasRealClientData: !!clientData.id, // Track if client data is real
        // REMOVED: _debug_budget, _debug_anything - No debug fields in production
      }
    })
    
    // ✅ Filter out jobs with no real data if needed
    const validJobs = jobs.filter((job: { id: any; title: any }) => job.id && job.title)
    console.log(`✅ Final: ${validJobs.length} REAL jobs ready (No mock data)`)
    
    // ✅ Log data quality report
    const jobsWithClientData = validJobs.filter((job: { client: { isRealData: any } }) => job.client.isRealData).length
    console.log(`📊 Data Quality: ${jobsWithClientData}/${validJobs.length} jobs have real client data`)
    
    return { 
      success: true, 
      jobs: validJobs, 
      error: null,
      stats: {
        total: validJobs.length,
        withRealClientData: jobsWithClientData,
        withRealBudget: validJobs.filter((j: { budget: string }) => j.budget !== 'Budget not specified').length
      }
    }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { 
      success: false, 
      error: `Connection error: ${error.message}`, 
      jobs: [] 
    }
  }
}

export async function GET() {
  try {
    console.log('=== JOBS API: PURE REAL DATA VERSION ===')
    
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
        message: '🔗 Connect Upwork account to see real jobs',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    const result = await fetchUpworkJobs(accessToken)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success ? 
        `✅ 100% REAL: ${result.jobs.length} jobs from Upwork API (No mock data)` : 
        `❌ Error: ${result.error}`,
      upworkConnected: true,
      dataQuality: result.success ? 'Pure real data - no mock' : 'API issue',
      stats: result.stats || {}
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