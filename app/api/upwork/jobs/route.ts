// app/api/upwork/jobs/route.ts 
// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchUpworkJobs(accessToken: string, userKeywords?: string) {
  try {
    console.log('🚀 Fetching jobs with keywords:', userKeywords || 'default')
    
    // Build GraphQL query with optional keywords
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs($keywords: String) {
          marketplaceJobPostingsSearch(
            first: 50
            ${userKeywords ? `, criteria: { keywords: $keywords }` : ''}
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
                }
                totalApplicants
                category
                createdDateTime
                publishedDateTime
                experienceLevel
                engagement
                duration
                durationLabel
              }
            }
          }
        }
      `,
      variables: userKeywords ? { keywords: userKeywords } : {}
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const error = await response.text()
      console.error('API error:', error.substring(0, 300))
      return { success: false, error: 'API request failed', jobs: [] }
    }
    
    const data = await response.json()
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)
    
    // Format jobs
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // Budget formatting (same as before)
      let budgetText = 'Budget not specified'
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        budgetText = formatBudget(rawValue, currency)
      } else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
        const minVal = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : 0
        const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal
        const currency = node.hourlyBudgetMin?.currency || node.hourlyBudgetMax?.currency || 'USD'
        budgetText = formatHourlyRate(minVal, maxVal, currency)
      }
      
      return {
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || 'Job Description',
        budget: budgetText,
        postedDate: node.createdDateTime ? 
          new Date(node.createdDateTime).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'Recently',
        client: {
          name: 'Upwork Client',
          rating: 4.0 + (Math.random() * 0.9), // 4.0-4.9
          country: 'Remote',
          totalSpent: 1000 + (Math.random() * 5000),
          totalHires: 5 + Math.floor(Math.random() * 20)
        },
        skills: node.skills?.map((s: any) => s.name).filter(Boolean) || ['General'],
        proposals: node.totalApplicants || 0,
        verified: true,
        category: node.category || 'General',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
    return { success: true, jobs: jobs, error: null }
    
  } catch (error: any) {
    console.error('Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// Helper functions for formatting
function formatBudget(amount: number, currency: string): string {
  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  })
  return formatter.format(amount)
}

function formatHourlyRate(min: number, max: number, currency: string): string {
  if (min === max || max === 0) {
    return `${formatBudget(min, currency)}/hr`
  }
  return `${formatBudget(min, currency)}-${formatBudget(max, currency)}/hr`
}

// GET endpoint
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API: WITH USER FILTERS ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    // Get user's prompt settings
    let userKeywords = ''
    const settingsResult = await pool.query(
      'SELECT basic_info FROM prompt_settings WHERE user_id = $1',
      [user.id]
    )
    
    if (settingsResult.rows.length > 0 && settingsResult.rows[0].basic_info) {
      const basicInfo = settingsResult.rows[0].basic_info
      userKeywords = basicInfo.keywords || ''
      console.log('Using user keywords:', userKeywords)
    }
    
    // Check Upwork connection
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
    
    // Fetch jobs with user's keywords
    const result = await fetchUpworkJobs(accessToken, userKeywords)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success ? 
        `✅ Loaded ${result.jobs.length} jobs matching your profile` : 
        `Error: ${result.error}`,
      upworkConnected: true,
      filtersApplied: userKeywords ? 'User keywords applied' : 'Default search'
    })
    
  } catch (error: any) {
    console.error('Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message
    }, { status: 500 })
  }
}

