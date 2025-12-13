// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Get user's prompt settings for job filtering
async function getUserPromptSettings(userId: number) {
  try {
    const result = await pool.query(
      'SELECT basic_info, validation_rules FROM prompt_settings WHERE user_id = $1',
      [userId]
    )
    
    if (result.rows.length > 0) {
      return result.rows[0]
    }
    
    // Return default if no settings found
    return {
      basic_info: {
        keywords: '"web development" OR "react" OR "node.js" OR "full stack"',
        location: 'Worldwide',
        specialty: 'Web Development'
      },
      validation_rules: {
        minBudget: 100,
        maxBudget: 10000,
        clientRating: 4.0
      }
    }
  } catch (error) {
    console.error('Error getting prompt settings:', error)
    return null
  }
}

// ✅ Build GraphQL query based on user's prompts
function buildJobSearchQuery(userSettings: any) {
  const keywords = userSettings?.basic_info?.keywords || '"web development" OR "react" OR "node.js"'
  const location = userSettings?.basic_info?.location || 'Worldwide'
  
  // Parse keywords for GraphQL
  const keywordArray = keywords
    .split(' OR ')
    .map((k: string) => k.trim().replace(/"/g, ''))
    .filter((k: string) => k.length > 0)

  // Build search string
  const searchString = keywordArray.length > 0 
    ? keywordArray.join(' OR ')
    : 'web development'

  // Build category filters
  let category = 'web-mobile-software-dev'
  if (keywords.toLowerCase().includes('react') || keywords.toLowerCase().includes('javascript')) {
    category = 'web-mobile-software-dev'
  } else if (keywords.toLowerCase().includes('design')) {
    category = 'design-creative'
  } else if (keywords.toLowerCase().includes('writing')) {
    category = 'writing'
  }

  return {
    query: `
      query GetJobsByUserSettings {
        marketplaceJobPostingsSearch(
          input: {
            searchQuery: "${searchString}"
            category: "${category}"
            location: "${location}"
            paging: { first: 20 }
            sort: { field: POSTED_DATE, direction: DESC }
          }
        ) {
          totalCount
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
              }
              hourlyBudgetMax {
                rawValue
                currency
              }
              skills {
                skill {
                  name
                  prettyName
                }
              }
              totalApplicants
              category
              client {
                displayName
                totalSpent
                location {
                  country
                }
                feedback {
                  score
                  count
                }
              }
              createdDateTime
              jobType
              experienceLevel
              engagement
            }
          }
        }
      }
    `
  }
}

async function fetchJobsWithUserSettings(accessToken: string, userId: number) {
  try {
    console.log('🚀 Fetching jobs with user-specific settings...')
    
    // Get user's prompt settings
    const userSettings = await getUserPromptSettings(userId)
    console.log('📝 User settings:', {
      keywords: userSettings?.basic_info?.keywords,
      location: userSettings?.basic_info?.location
    })
    
    // Build query based on user settings
    const graphqlQuery = buildJobSearchQuery(userSettings)
    console.log('🔍 GraphQL Query:', graphqlQuery.query.substring(0, 200) + '...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ GraphQL error:', errorText.substring(0, 300))
      return { success: false, error: 'API request failed', jobs: [] }
    }
    
    const data = await response.json()
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} jobs for user's settings`)
    
    // Filter jobs based on user's validation rules
    const minBudget = userSettings?.validation_rules?.minBudget || 100
    const maxBudget = userSettings?.validation_rules?.maxBudget || 10000
    const minRating = userSettings?.validation_rules?.clientRating || 4.0
    
    const filteredJobs = edges.filter((edge: any) => {
      const job = edge.node
      const amount = job.amount?.rawValue || job.hourlyBudgetMin?.rawValue || 0
      const clientRating = job.client?.feedback?.score || 4.0
      
      // Apply budget filter
      if (amount < minBudget || amount > maxBudget) return false
      
      // Apply client rating filter
      if (clientRating < minRating) return false
      
      return true
    })
    
    console.log(`📊 After filtering: ${filteredJobs.length} jobs meet criteria`)
    
    // Format jobs
    const formattedJobs = filteredJobs.map((edge: any) => {
      const job = edge.node
      
      const budgetText = job.amount?.displayValue || 
        (job.hourlyBudgetMin?.rawValue ? 
          `${job.hourlyBudgetMin.currency} ${job.hourlyBudgetMin.rawValue}/hr` + 
          (job.hourlyBudgetMax?.rawValue ? `-${job.hourlyBudgetMax.rawValue}/hr` : '') : 
          'Budget not specified')
      
      const skills = job.skills?.map((s: any) => s.skill?.prettyName || s.skill?.name).filter(Boolean) || 
                    ['Development']
      
      return {
        id: job.id || `job_${Date.now()}`,
        title: job.title || 'Job Title',
        description: job.description || 'Job Description',
        budget: budgetText,
        postedDate: job.createdDateTime ? 
          new Date(job.createdDateTime).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'Recently',
        client: {
          name: job.client?.displayName || 'Client',
          rating: job.client?.feedback?.score || 4.0,
          country: job.client?.location?.country || 'Remote',
          totalSpent: job.client?.totalSpent || 0,
          totalHires: job.client?.feedback?.count || 0
        },
        skills: skills.slice(0, 5),
        proposals: job.totalApplicants || 0,
        verified: true,
        category: job.category || 'Web Development',
        jobType: job.jobType || job.engagement || 'Fixed Price',
        experienceLevel: job.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        _raw: job // Keep raw data for proposal generation
      }
    })
    
    return { success: true, jobs: formattedJobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error)
    return { success: false, error: error.message, jobs: [] }
  }
}

export async function GET() {
  try {
    console.log('=== JOBS API WITH USER PROMPTS ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
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
        message: '🔗 Connect Upwork account to see jobs',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Fetch jobs using user's prompt settings
    const result = await fetchJobsWithUserSettings(accessToken, user.id)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      upworkConnected: true,
      message: result.success ? 
        `✅ Found ${result.jobs.length} jobs matching your criteria` : 
        `❌ Error: ${result.error}`,
      settingsUsed: {
        userId: user.id,
        hasPrompts: true
      }
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


