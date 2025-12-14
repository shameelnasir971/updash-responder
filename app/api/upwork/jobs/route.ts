// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Cache jobs for 5 minutes to reduce API calls
const jobsCache = new Map()

async function getUserPromptSettings(userId: number) {
  try {
    const result = await pool.query(
      'SELECT basic_info, validation_rules FROM prompt_settings WHERE user_id = $1',
      [userId]
    )
    
    if (result.rows.length > 0) {
      return result.rows[0]
    }
    
    // DEFAULT VALUES FOR FIRST TIME USERS
    return {
      basic_info: {
        keywords: '"web development" OR "react" OR "node.js" OR "javascript" OR "typescript" OR "python" OR "full stack" OR "frontend" OR "backend"',
        location: 'Worldwide',
        specialty: 'Web Development',
        hourlyRate: '$25-50'
      },
      validation_rules: {
        minBudget: 100,
        maxBudget: 10000,
        clientRating: 4.0,
        jobTypes: ['Fixed', 'Hourly'],
        requiredSkills: ['JavaScript', 'React', 'Node.js']
      }
    }
  } catch (error) {
    console.error('Error getting prompt settings:', error)
    return null
  }
}

// ✅ REAL GRAPHQL QUERY WITH PAGINATION
async function fetchJobsFromUpwork(accessToken: string, userSettings: any, page: number = 1, perPage: number = 20) {
  try {
    console.log(`🚀 Fetching REAL jobs - Page ${page}, ${perPage} per page...`)
    
    // Parse user's keywords
    const keywordStr = userSettings?.basic_info?.keywords || ''
    const keywords = keywordStr
      .split(' OR ')
      .map((k: string) => k.trim().replace(/"/g, ''))
      .filter((k: string) => k.length > 0)
    
    const searchQuery = keywords.length > 0 ? keywords.join(' ') : 'web development javascript react node'
    
    // Calculate offset for pagination
    const first = perPage
    const skip = (page - 1) * perPage
    
    // ✅ ENHANCED QUERY WITH ALL FIELDS
    const graphqlQuery = {
      query: `
        query GetJobsWithPagination($query: String!, $first: Int!, $skip: Int) {
          marketplaceJobPostingsSearch(
            marketPlaceJobFilter: {
              searchQuery: $query
            }
            sortAttributes: {
              field: POSTED_DATE
              direction: DESC
            }
            first: $first
            skip: $skip
          ) {
            totalCount
            edges {
              node {
                id
                title
                description
                jobType
                category {
                  title
                }
                subcategory {
                  title
                }
                postedOn
                proposalCount
                engagement
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
                skills {
                  skill {
                    name
                    prettyName
                  }
                }
                duration {
                  label
                }
                experienceLevel
                budget {
                  amount
                  currency {
                    code
                  }
                }
                estimatedWorkload
                contractTier
                clientActivity
                preferredQualifications
                enterprise
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
          }
        }
      `,
      variables: {
        query: searchQuery,
        first: first,
        skip: skip
      }
    }
    
    console.log(`🔍 Search query: ${searchQuery}, Page: ${page}, Limit: ${first}`)
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API error:', errorText.substring(0, 300))
      return { success: false, error: 'API request failed', jobs: [] }
    }
    
    const data = await response.json()
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    const totalCount = data.data?.marketplaceJobPostingsSearch?.totalCount || 0
    
    console.log(`✅ Found ${edges.length} jobs out of ${totalCount} total`)
    
    if (edges.length === 0) {
      return { success: true, jobs: [], totalCount: 0, hasNextPage: false }
    }
    
    // ✅ FORMAT REAL JOBS WITH DETAILS
    const formattedJobs = edges.map((edge: any) => {
      const job = edge.node
      
      // REAL BUDGET
      let budgetText = 'Budget not specified'
      let budgetAmount = 0
      if (job.budget?.amount) {
        const amount = parseFloat(job.budget.amount)
        const currency = job.budget.currency?.code || 'USD'
        budgetText = `${currency} ${amount}`
        budgetAmount = amount
      }
      
      // REAL CLIENT DATA
      const clientRating = job.client?.feedback?.score || 0
      const clientSpent = job.client?.totalSpent || 0
      const clientHires = job.client?.feedback?.count || 0
      const clientCountry = job.client?.location?.country || 'Remote'
      
      // REAL SKILLS
      const skills = job.skills?.map((s: any) => s.skill?.prettyName || s.skill?.name).filter(Boolean) || 
                    [job.category?.title || 'Development']
      
      // REAL DATE
      const postedDate = job.postedOn ? 
        new Date(job.postedOn).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Just now'
      
      // REAL PROPOSALS
      const proposals = job.proposalCount || 0
      
      return {
        id: job.id,
        title: job.title || 'Job Title',
        description: job.description || 'No description provided',
        budget: budgetText,
        budgetAmount: budgetAmount,
        postedDate: postedDate,
        postedTimestamp: job.postedOn || new Date().toISOString(),
        client: {
          name: job.client?.displayName || 'Client',
          rating: parseFloat(clientRating.toFixed(1)),
          country: clientCountry,
          totalSpent: clientSpent,
          totalHires: clientHires
        },
        skills: skills.slice(0, 8),
        proposals: proposals,
        verified: true,
        category: job.category?.title || 'General',
        jobType: job.jobType || 'Fixed Price',
        experienceLevel: job.experienceLevel || 'Not specified',
        duration: job.duration?.label || 'Not specified',
        estimatedWorkload: job.estimatedWorkload || 'Not specified',
        contractTier: job.contractTier || 'Standard',
        source: 'upwork',
        isRealJob: true,
        raw: job // Keep raw data for debugging
      }
    })
    
    // Apply user's budget filters
    const minBudget = userSettings?.validation_rules?.minBudget || 100
    const maxBudget = userSettings?.validation_rules?.maxBudget || 10000
    const clientRating = userSettings?.validation_rules?.clientRating || 4.0
    
    const filteredJobs = formattedJobs.filter((job: any) => {
      // Budget filter
      if (job.budgetAmount > 0) {
        if (job.budgetAmount < minBudget || job.budgetAmount > maxBudget) {
          return false
        }
      }
      
      // Client rating filter
      if (job.client.rating < clientRating) {
        return false
      }
      
      return true
    })
    
    console.log(`📊 After filtering: ${filteredJobs.length} jobs`)
    
    const hasNextPage = data.data?.marketplaceJobPostingsSearch?.pageInfo?.hasNextPage || false
    
    return { 
      success: true, 
      jobs: filteredJobs, 
      totalCount: totalCount,
      hasNextPage: hasNextPage,
      page: page,
      perPage: perPage
    }
    
  } catch (error: any) {
    console.error('❌ Upwork fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== REAL JOBS API WITH PAGINATION ===')
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('perPage') || '20')
    const refresh = searchParams.get('refresh') === 'true'
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    console.log(`👤 User: ${user.email}, Page: ${page}, PerPage: ${perPage}`)
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('⚠️ No Upwork connection')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Connect Upwork first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    console.log('✅ Access token found')
    
    // Get user's prompt settings (with defaults)
    const userSettings = await getUserPromptSettings(user.id)
    console.log('📝 User settings:', {
      keywords: userSettings?.basic_info?.keywords?.substring(0, 50) + '...',
      minBudget: userSettings?.validation_rules?.minBudget,
      maxBudget: userSettings?.validation_rules?.maxBudget,
      clientRating: userSettings?.validation_rules?.clientRating
    })
    
    // Try to fetch REAL jobs with pagination
    const result = await fetchJobsFromUpwork(accessToken, userSettings, page, perPage)
    
    // If no jobs found, try with broader search
    if (!result.success || result.jobs.length === 0) {
      console.log('🔄 Trying broader search...')
      
      const broadSettings = {
        basic_info: {
          keywords: '"web development" OR "software" OR "programming" OR "coding"'
        },
        validation_rules: {
          minBudget: 50,
          maxBudget: 50000,
          clientRating: 3.0
        }
      }
      
      const broadResult = await fetchJobsFromUpwork(accessToken, broadSettings, page, perPage)
      
      if (broadResult.success && broadResult.jobs.length > 0) {
        console.log(`✅ Found ${broadResult.jobs.length} jobs with broader search`)
        
        return NextResponse.json({
          success: true,
          jobs: broadResult.jobs,
          total: broadResult.totalCount,
          page: page,
          perPage: perPage,
          totalPages: Math.ceil(broadResult.totalCount / perPage),
          hasNextPage: broadResult.hasNextPage,
          upworkConnected: true,
          message: `Found ${broadResult.jobs.length} jobs (using broader search)`,
          debug: {
            userSettingsUsed: false,
            broadSearch: true,
            firstJobId: broadResult.jobs[0]?.id
          }
        })
      }
    }
    
    // ✅ REAL JOBS FOUND
    if (result.success && result.jobs.length > 0) {
      console.log(`🎉 Found ${result.jobs.length} REAL jobs on page ${page}`)
      
      const totalPages = Math.ceil(result.totalCount / perPage)
      
      return NextResponse.json({
        success: true,
        jobs: result.jobs,
        total: result.totalCount,
        page: page,
        perPage: perPage,
        totalPages: totalPages,
        hasNextPage: result.hasNextPage,
        upworkConnected: true,
        message: `✅ Found ${result.jobs.length} real jobs (Page ${page} of ${totalPages})`,
        debug: {
          queryUsed: 'marketplaceJobPostingsSearch',
          mockDataUsed: false,
          userFilterApplied: true,
          totalAvailableJobs: result.totalCount
        }
      })
    }
    
    // ✅ NO JOBS FOUND
    console.log('ℹ️ No real jobs found')
    
    return NextResponse.json({
      success: true,
      jobs: [],
      total: 0,
      page: 1,
      perPage: perPage,
      totalPages: 0,
      hasNextPage: false,
      upworkConnected: true,
      message: 'No matching jobs found. Try updating your prompts settings.',
      debug: {
        mockDataUsed: false,
        totalRealJobs: 0
      }
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error.message)
    
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message,
      upworkConnected: false
    }, { status: 500 })
  }
}