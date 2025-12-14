// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Cache mechanism for jobs (5 minutes)
const jobsCache = new Map()
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// ✅ Get user's prompt settings
async function getUserPromptSettings(userId: number) {
  try {
    const result = await pool.query(
      'SELECT basic_info, validation_rules FROM prompt_settings WHERE user_id = $1',
      [userId]
    )
    
    if (result.rows.length > 0) {
      return result.rows[0]
    }
    
    // Default settings
    return {
      basic_info: {
        keywords: '"web development" OR "react" OR "node.js" OR "javascript" OR "python" OR "api" OR "mobile app"',
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

// ✅ REAL GRAPHQL QUERY WITH PAGINATION
async function fetchUpworkJobsWithPagination(
  accessToken: string, 
  userSettings: any, 
  page: number = 1, 
  pageSize: number = 20
) {
  try {
    console.log(`📥 Fetching page ${page} with ${pageSize} jobs...`)
    
    // Parse keywords
    const keywordStr = userSettings?.basic_info?.keywords || ''
    const keywords = keywordStr
      .split(' OR ')
      .map((k: string) => k.trim().replace(/"/g, ''))
      .filter((k: string) => k.length > 0)
    
    const searchQuery = keywords.length > 0 ? keywords.join(' ') : 'web development'
    
    // ✅ GRAPHQL QUERY WITH COMPLETE DATA
    const graphqlQuery = {
      query: `
        query GetJobs($query: String!, $first: Int!, $after: String) {
          marketplaceJobPostingsSearch(
            marketPlaceJobFilter: {
              searchQuery: $query
              sortAttributes: {
                field: POSTED_DATE
                direction: DESC
              }
            }
            first: $first
            after: $after
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
                  company {
                    name
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
                rawBudget
                workload
                enterpriseJob
                preferredFreelancerLocation
                preferredFreelancerLocationMandatory
              }
              cursor
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
        first: pageSize
      }
    }
    
    console.log('🔍 Search query:', searchQuery)
    
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
      console.error('❌ API error:', response.status, errorText.substring(0, 200))
      throw new Error(`API Error ${response.status}: ${errorText.substring(0, 100)}`)
    }
    
    const data = await response.json()
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      throw new Error(`GraphQL Error: ${data.errors[0]?.message}`)
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    const totalCount = data.data?.marketplaceJobPostingsSearch?.totalCount || 0
    const pageInfo = data.data?.marketplaceJobPostingsSearch?.pageInfo || {}
    
    console.log(`✅ Found ${edges.length} jobs (Total: ${totalCount})`)
    
    if (edges.length === 0) {
      return { success: true, jobs: [], totalCount: 0, pageInfo: {} }
    }
    
    // ✅ FORMAT REAL JOBS ONLY - NO MOCK
    const formattedJobs = edges.map((edge: any) => {
      const job = edge.node
      
      // Extract budget
      let budgetText = 'Budget not specified'
      if (job.budget?.amount) {
        const amount = parseFloat(job.budget.amount)
        const currency = job.budget.currency?.code || 'USD'
        budgetText = `${currency} ${amount.toLocaleString()}`
      } else if (job.rawBudget) {
        budgetText = job.rawBudget
      }
      
      // Client info
      const clientRating = job.client?.feedback?.score || 0
      const clientSpent = job.client?.totalSpent || 0
      const clientHires = job.client?.feedback?.count || 0
      const clientCountry = job.client?.location?.country || 'Remote'
      const clientName = job.client?.displayName || job.client?.company?.name || 'Client'
      
      // Skills
      const skills = job.skills?.map((s: any) => 
        s.skill?.prettyName || s.skill?.name || 'Skill'
      ).filter(Boolean) || []
      
      // Date
      const postedDate = job.postedOn ? 
        new Date(job.postedOn).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Recently'
      
      return {
        id: job.id,
        title: job.title || 'Job',
        description: job.description || '',
        budget: budgetText,
        budgetAmount: job.budget?.amount ? parseFloat(job.budget.amount) : 0,
        postedDate: postedDate,
        postedTimestamp: job.postedOn,
        client: {
          name: clientName,
          rating: parseFloat(clientRating.toFixed(1)),
          country: clientCountry,
          totalSpent: clientSpent,
          totalHires: clientHires,
          company: job.client?.company?.name || '',
          isEnterprise: job.enterpriseJob || false
        },
        skills: skills.slice(0, 8),
        proposals: job.proposalCount || 0,
        verified: true,
        category: job.category?.title || 'General',
        subcategory: job.subcategory?.title || '',
        jobType: job.jobType || 'Fixed Price',
        experienceLevel: job.experienceLevel || 'Not specified',
        duration: job.duration?.label || 'Not specified',
        workload: job.workload || '',
        preferredLocation: job.preferredFreelancerLocation || 'Anywhere',
        locationMandatory: job.preferredFreelancerLocationMandatory || false,
        engagement: job.engagement || '',
        source: 'upwork',
        isRealJob: true,
        cursor: edge.cursor,
        rawData: {
          hasBudget: !!job.budget,
          hasClient: !!job.client,
          enterprise: job.enterpriseJob || false
        }
      }
    })
    
    // Filter by budget if settings exist
    const minBudget = userSettings?.validation_rules?.minBudget || 0
    const maxBudget = userSettings?.validation_rules?.maxBudget || 100000
    const minRating = userSettings?.validation_rules?.clientRating || 0
    
    const filteredJobs = formattedJobs.filter((job: any) => {
      // Budget filter
      if (job.budgetAmount > 0) {
        if (job.budgetAmount < minBudget || job.budgetAmount > maxBudget) {
          return false
        }
      }
      
      // Rating filter
      if (job.client.rating < minRating) {
        return false
      }
      
      return true
    })
    
    console.log(`📊 After filtering: ${filteredJobs.length} jobs`)
    
    return { 
      success: true, 
      jobs: filteredJobs, 
      totalCount: totalCount,
      pageInfo: pageInfo,
      rawCount: edges.length
    }
    
  } catch (error: any) {
    console.error('❌ Upwork API error:', error.message)
    return { 
      success: false, 
      error: error.message, 
      jobs: [], 
      totalCount: 0,
      pageInfo: {}
    }
  }
}

// ✅ BATCH FETCH FUNCTION (Gets 50+ jobs)
async function fetchMultipleJobPages(
  accessToken: string, 
  userSettings: any, 
  targetCount: number = 50
) {
  let allJobs: any[] = []
  let page = 1
  const pageSize = 20
  let hasNextPage = true
  let endCursor = null
  
  console.log(`🎯 Fetching ${targetCount} jobs in batches...`)
  
  while (allJobs.length < targetCount && hasNextPage) {
    try {
      console.log(`📄 Fetching batch ${page}...`)
      
      const result = await fetchUpworkJobsWithPagination(
        accessToken, 
        userSettings, 
        page, 
        pageSize
      )
      
      if (!result.success) {
        console.log(`⚠️ Batch ${page} failed: ${result.error}`)
        break
      }
      
      if (result.jobs.length === 0) {
        console.log('ℹ️ No more jobs available')
        break
      }
      
      // Add new jobs (avoid duplicates)
      const newJobs = result.jobs.filter((newJob: any) => 
        !allJobs.some(existingJob => existingJob.id === newJob.id)
      )
      
      allJobs = [...allJobs, ...newJobs]
      hasNextPage = result.pageInfo.hasNextPage
      endCursor = result.pageInfo.endCursor
      
      console.log(`✅ Batch ${page}: +${newJobs.length} jobs (Total: ${allJobs.length})`)
      
      if (allJobs.length >= targetCount) {
        console.log(`🎉 Reached target of ${targetCount} jobs`)
        break
      }
      
      page++
      
      // Small delay between requests
      if (hasNextPage && allJobs.length < targetCount) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
      
    } catch (error: any) {
      console.error(`❌ Error in batch ${page}:`, error.message)
      break
    }
  }
  
  return {
    success: true,
    jobs: allJobs.slice(0, targetCount),
    totalJobs: allJobs.length,
    batchesFetched: page,
    reachedTarget: allJobs.length >= targetCount
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== REAL JOBS API WITH PAGINATION ===')
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '10')
    const refresh = searchParams.get('refresh') === 'true'
    
    console.log(`📊 Request: page=${page}, pageSize=${pageSize}, refresh=${refresh}`)
    
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
      console.log('⚠️ No Upwork connection')
      return NextResponse.json({
        success: false,
        jobs: [],
        pagination: {},
        message: 'Connect Upwork first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Get user settings
    const userSettings = await getUserPromptSettings(user.id)
    
    // Check cache first (unless refresh requested)
    const cacheKey = `${user.id}_jobs`
    if (!refresh && jobsCache.has(cacheKey)) {
      const cached = jobsCache.get(cacheKey)
      if (Date.now() - cached.timestamp < CACHE_DURATION) {
        console.log('🔄 Using cached jobs')
        
        const allJobs = cached.jobs
        const startIndex = (page - 1) * pageSize
        const endIndex = startIndex + pageSize
        const paginatedJobs = allJobs.slice(startIndex, endIndex)
        
        return NextResponse.json({
          success: true,
          jobs: paginatedJobs,
          pagination: {
            currentPage: page,
            pageSize: pageSize,
            totalJobs: allJobs.length,
            totalPages: Math.ceil(allJobs.length / pageSize),
            hasNextPage: endIndex < allJobs.length,
            hasPrevPage: page > 1
          },
          upworkConnected: true,
          message: `✅ Showing ${paginatedJobs.length} of ${allJobs.length} real jobs`,
          debug: {
            cached: true,
            cacheTime: new Date(cached.timestamp).toISOString()
          }
        })
      }
    }
    
    console.log('🔄 Fetching fresh jobs from Upwork...')
    
    // Fetch 50+ jobs in batches
    const result = await fetchMultipleJobPages(accessToken, userSettings, 50)
    
    if (!result.success || result.jobs.length === 0) {
      console.log('ℹ️ No real jobs found')
      
      // Clear cache on failure
      jobsCache.delete(cacheKey)
      
      return NextResponse.json({
        success: true,
        jobs: [],
        pagination: {
          currentPage: 1,
          pageSize: pageSize,
          totalJobs: 0,
          totalPages: 0,
          hasNextPage: false,
          hasPrevPage: false
        },
        upworkConnected: true,
        message: 'No matching jobs found. Try updating your prompts settings.',
        debug: {
          fetchedJobs: 0,
          mockDataUsed: false
        }
      })
    }
    
    console.log(`🎉 Successfully fetched ${result.jobs.length} real jobs`)
    
    // Update cache
    jobsCache.set(cacheKey, {
      jobs: result.jobs,
      timestamp: Date.now()
    })
    
    // Paginate results
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize
    const paginatedJobs = result.jobs.slice(startIndex, endIndex)
    const totalJobs = result.jobs.length
    const totalPages = Math.ceil(totalJobs / pageSize)
    
    return NextResponse.json({
      success: true,
      jobs: paginatedJobs,
      pagination: {
        currentPage: page,
        pageSize: pageSize,
        totalJobs: totalJobs,
        totalPages: totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      },
      upworkConnected: true,
      message: `✅ Found ${totalJobs} real jobs! Showing ${paginatedJobs.length} on page ${page}`,
      debug: {
        fetchedJobs: result.jobs.length,
        batches: result.batchesFetched,
        reachedTarget: result.reachedTarget,
        mockDataUsed: false,
        firstJobId: result.jobs[0]?.id,
        firstJobTitle: result.jobs[0]?.title?.substring(0, 30)
      }
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error.message)
    
    return NextResponse.json({
      success: false,
      jobs: [],
      pagination: {},
      message: 'Server error: ' + error.message,
      upworkConnected: false,
      debug: { mockDataUsed: false }
    }, { status: 500 })
  }
}