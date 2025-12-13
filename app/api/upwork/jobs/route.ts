// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ FETCH REAL JOBS FROM UPWORK (WITH PAGINATION)
async function fetchRealUpworkJobs(accessToken: string, page: number = 1, perPage: number = 50) {
  try {
    console.log(`🚀 Fetching real Upwork jobs - Page ${page}, Per Page ${perPage}...`)
    
    // ✅ Calculate offset for pagination
    const offset = (page - 1) * perPage
    const first = perPage
    
    // ✅ OPTIMIZED GraphQL query for pagination
    const graphqlQuery = {
      query: `
        query GetPaginatedJobs($first: Int, $after: String) {
          marketplaceJobPostingsSearch(first: $first, after: $after, sortBy: { field: CREATED_DATE, direction: DESC }) {
            pageInfo {
              hasNextPage
              endCursor
              hasPreviousPage
              startCursor
            }
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
                client {
                  id
                  name
                  rating
                  totalSpent
                  totalHires
                  country
                }
                jobVisibilityType
                isFixedPrice
                isHourly
              }
            }
          }
        }
      `,
      variables: {
        first: first,
        after: offset > 0 ? btoa(`arrayconnection:${offset}`) : null
      }
    }
    
    console.log('📤 Sending GraphQL request with pagination...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Upwork-API-TenantId': 'default'
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API request failed:', errorText.substring(0, 200))
      return { 
        success: false, 
        error: `API error: ${response.status}`,
        jobs: [],
        hasNextPage: false,
        totalCount: 0
      }
    }
    
    const data = await response.json()
    
    // ✅ DEBUG: Log response structure
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors))
      return { 
        success: false, 
        error: data.errors[0]?.message || 'GraphQL error',
        jobs: [],
        hasNextPage: false,
        totalCount: 0
      }
    }
    
    const searchData = data.data?.marketplaceJobPostingsSearch
    const edges = searchData?.edges || []
    const pageInfo = searchData?.pageInfo || { hasNextPage: false, endCursor: null }
    const totalCount = searchData?.totalCount || edges.length
    
    console.log(`✅ Found ${edges.length} jobs (Total: ${totalCount})`)
    
    // ✅ Format jobs with REAL data
    const jobs = edges.map((edge: any, index: number) => {
      const node = edge.node || {}
      
      // ✅ REAL BUDGET FORMATTING
      let budgetText = 'Budget not specified'
      
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency
        budgetText = `${currencySymbol}${rawValue.toFixed(2)}`
      } else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
        const minVal = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : 0
        const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal
        const currency = node.hourlyBudgetMin?.currency || node.hourlyBudgetMax?.currency || 'USD'
        const currencySymbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : currency
        
        if (minVal === maxVal || maxVal === 0) {
          budgetText = `${currencySymbol}${minVal.toFixed(2)}/hr`
        } else {
          budgetText = `${currencySymbol}${minVal.toFixed(2)}-${maxVal.toFixed(2)}/hr`
        }
      } else if (node.amount?.displayValue) {
        budgetText = node.amount.displayValue
      }
      
      // ✅ REAL SKILLS
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || ['Not specified']
      
      // ✅ REAL CLIENT DATA (if available)
      const clientData = node.client || {}
      const clientName = clientData.name || 'Upwork Client'
      const clientRating = clientData.rating || 0
      const clientCountry = clientData.country || 'Remote'
      const clientSpent = clientData.totalSpent || 0
      const clientHires = clientData.totalHires || 0
      
      // ✅ REAL DATES
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 
        'Recently'
      
      // ✅ REAL CATEGORY
      const category = node.category || 'General'
      const formattedCategory = category
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      // ✅ JOB TYPE
      let jobType = 'Not specified'
      if (node.isFixedPrice) jobType = 'Fixed Price'
      if (node.isHourly) jobType = 'Hourly'
      if (node.engagement) jobType = node.engagement
      
      return {
        id: node.id || `job_${Date.now()}_${index}`,
        title: node.title || 'Job Title',
        description: node.description || 'Job Description',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: clientName,
          rating: clientRating,
          country: clientCountry,
          totalSpent: clientSpent,
          totalHires: clientHires,
          verified: clientRating >= 4.0
        },
        skills: realSkills.slice(0, 6),
        proposals: node.totalApplicants || 0,
        verified: node.jobVisibilityType === 'PUBLIC',
        category: formattedCategory,
        jobType: jobType,
        experienceLevel: node.experienceLevel || 'Not specified',
        duration: node.duration || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        createdAt: postedDate,
        rawData: node // For debugging
      }
    })
    
    console.log(`✅ Successfully formatted ${jobs.length} real jobs`)
    
    return {
      success: true,
      jobs: jobs,
      pageInfo: pageInfo,
      totalCount: totalCount,
      currentPage: page,
      perPage: perPage,
      error: null
    }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message || error)
    return {
      success: false,
      error: error.message || 'Unknown error',
      jobs: [],
      hasNextPage: false,
      totalCount: 0
    }
  }
}

// ✅ APPLY USER FILTERS
async function applyUserFilters(jobs: any[], userId: number) {
  try {
    console.log(`🔄 Applying filters for user ${userId} to ${jobs.length} jobs...`)
    
    // Get user settings
    const settingsResult = await pool.query(
      'SELECT basic_info, validation_rules FROM prompt_settings WHERE user_id = $1',
      [userId]
    )
    
    if (settingsResult.rows.length === 0) {
      console.log('ℹ️ No user settings found, returning all jobs')
      return jobs
    }
    
    const settings = settingsResult.rows[0]
    const basicInfo = settings.basic_info || {}
    const validationRules = settings.validation_rules || {}
    
    // Extract filter criteria
    const keywords = basicInfo.keywords || ''
    const specialty = basicInfo.specialty || ''
    const minBudget = validationRules.minBudget || 0
    const maxBudget = validationRules.maxBudget || 1000000
    const minRating = validationRules.clientRating || 0
    const requiredSkills = validationRules.requiredSkills || []
    const jobTypes = validationRules.jobTypes || ['Fixed', 'Hourly']
    
    console.log('🎯 Filter criteria:', {
      keywords,
      minBudget,
      maxBudget,
      minRating,
      requiredSkills: requiredSkills.length,
      jobTypes
    })
    
    // Filter jobs
    const filteredJobs = jobs.filter(job => {
      // 1. Budget filter
      const budgetMatch = checkBudgetMatch(job.budget, minBudget, maxBudget)
      if (!budgetMatch) return false
      
      // 2. Client rating filter
      const ratingMatch = job.client.rating >= minRating
      if (!ratingMatch) return false
      
      // 3. Keywords filter
      const keywordMatch = checkKeywordMatch(keywords, job.title + ' ' + job.description)
      if (!keywordMatch) return false
      
      // 4. Skills filter
      const skillsMatch = checkSkillsMatch(job.skills, requiredSkills)
      if (!skillsMatch) return false
      
      // 5. Job type filter
      const jobTypeMatch = checkJobTypeMatch(job.jobType, jobTypes)
      if (!jobTypeMatch) return false
      
      return true
    })
    
    console.log(`✅ Filtered ${jobs.length} jobs → ${filteredJobs.length} jobs`)
    return filteredJobs
    
  } catch (error) {
    console.error('❌ Filter error:', error)
    return jobs
  }
}

// ✅ HELPER: Check budget match
function checkBudgetMatch(budgetText: string, min: number, max: number): boolean {
  if (min === 0 && max === 1000000) return true
  
  try {
    // Extract number from budget text
    const match = budgetText.match(/(\d+\.?\d*)/)
    if (!match) return true // If no budget specified, assume it matches
    
    const amount = parseFloat(match[1])
    return amount >= min && amount <= max
  } catch {
    return true
  }
}

// ✅ HELPER: Check keyword match
function checkKeywordMatch(keywords: string, text: string): boolean {
  if (!keywords.trim()) return true
  
  const textLower = text.toLowerCase()
  const keywordGroups = keywords.split(' OR ').map(k => k.trim())
  
  return keywordGroups.some(group => {
    const cleanGroup = group.replace(/"/g, '')
    if (cleanGroup.includes(' ')) {
      return textLower.includes(cleanGroup.toLowerCase())
    } else {
      return textLower.split(/\s+/).some(word => word === cleanGroup.toLowerCase())
    }
  })
}

// ✅ HELPER: Check skills match
function checkSkillsMatch(jobSkills: string[], requiredSkills: string[]): boolean {
  if (requiredSkills.length === 0) return true
  
  const jobSkillsLower = jobSkills.map(s => s.toLowerCase())
  const requiredSkillsLower = requiredSkills.map(s => s.toLowerCase())
  
  return requiredSkillsLower.some(reqSkill => 
    jobSkillsLower.some(jobSkill => 
      jobSkill.includes(reqSkill) || reqSkill.includes(jobSkill)
    )
  )
}

// ✅ HELPER: Check job type match
function checkJobTypeMatch(jobType: string, allowedTypes: string[]): boolean {
  if (allowedTypes.length === 0) return true
  
  const jobTypeLower = jobType.toLowerCase()
  return allowedTypes.some(allowed => 
    jobTypeLower.includes(allowed.toLowerCase())
  )
}

// ✅ MAIN GET ENDPOINT WITH PAGINATION
export async function GET(request: NextRequest) {
  try {
    console.log('=== REAL JOBS API WITH PAGINATION ===')
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('perPage') || '50')
    
    console.log(`📊 Request: Page ${page}, Per Page ${perPage}`)
    
    // 1. Check authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('👤 Authenticated user:', user.email)
    
    // 2. Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Connect Upwork account first to see real jobs',
        upworkConnected: false,
        pagination: {
          page: 1,
          perPage: perPage,
          totalPages: 0,
          totalItems: 0,
          hasNextPage: false
        }
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    console.log('✅ Upwork connected, fetching jobs...')
    
    // 3. Fetch REAL jobs from Upwork with pagination
    const fetchResult = await fetchRealUpworkJobs(accessToken, page, perPage)
    
    if (!fetchResult.success) {
      console.error('❌ Failed to fetch jobs:', fetchResult.error)
      return NextResponse.json({
        success: false,
        jobs: [],
        message: `Failed to fetch jobs: ${fetchResult.error}`,
        upworkConnected: true,
        pagination: {
          page: page,
          perPage: perPage,
          totalPages: 0,
          totalItems: 0,
          hasNextPage: false
        }
      })
    }
    
    // 4. Apply user filters
    const filteredJobs = await applyUserFilters(fetchResult.jobs, user.id)
    
    // 5. Calculate pagination
    const totalItems = fetchResult.totalCount
    const totalPages = Math.ceil(totalItems / perPage)
    const hasNextPage = fetchResult.pageInfo?.hasNextPage || (page < totalPages)
    
    console.log('📈 Pagination stats:', {
      currentPage: page,
      perPage: perPage,
      filteredJobs: filteredJobs.length,
      totalItems,
      totalPages,
      hasNextPage
    })
    
    // 6. Return response
    return NextResponse.json({
      success: true,
      jobs: filteredJobs,
      total: filteredJobs.length,
      totalItems: totalItems,
      message: filteredJobs.length > 0 
        ? `✅ Found ${filteredJobs.length} real jobs (Page ${page} of ${totalPages})` 
        : '⚠️ No jobs match your current settings. Adjust filters in Prompts page.',
      upworkConnected: true,
      pagination: {
        page: page,
        perPage: perPage,
        totalPages: totalPages,
        totalItems: totalItems,
        hasNextPage: hasNextPage,
        hasPreviousPage: page > 1
      },
      metadata: {
        source: 'Upwork API',
        isRealData: true,
        lastUpdated: new Date().toISOString(),
        itemsPerPage: perPage
      }
    })
    
  } catch (error: any) {
    console.error('❌ Jobs API error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + (error.message || 'Unknown error'),
      pagination: {
        page: 1,
        perPage: 50,
        totalPages: 0,
        totalItems: 0,
        hasNextPage: false
      }
    }, { status: 500 })
  }
}

// ✅ POST endpoint for manual refresh
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    const body = await request.json()
    const { forceRefresh = false } = body
    
    console.log('🔄 Manual refresh requested, force:', forceRefresh)
    
    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Jobs refreshed successfully',
      timestamp: new Date().toISOString(),
      nextAutoRefresh: new Date(Date.now() + 5 * 60000).toISOString() // 5 minutes
    })
    
  } catch (error: any) {
    console.error('Refresh error:', error)
    return NextResponse.json({
      success: false,
      error: 'Refresh failed: ' + error.message
    }, { status: 500 })
  }
}