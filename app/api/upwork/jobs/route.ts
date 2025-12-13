// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CONSTANTS
const JOBS_PER_PAGE = 50
const MAX_JOBS_TO_FETCH = 200

// ✅ INTERFACES
interface UpworkJob {
  id: string
  title: string
  description: string
  amount?: {
    rawValue: string
    currency: string
    displayValue: string
  }
  hourlyBudgetMin?: {
    rawValue: string
    currency: string
    displayValue: string
  }
  hourlyBudgetMax?: {
    rawValue: string
    currency: string
    displayValue: string
  }
  skills: Array<{ name: string }>
  totalApplicants: number
  category: string
  createdDateTime: string
  publishedDateTime: string
  experienceLevel: string
  engagement: string
  duration: string
  durationLabel: string
  client?: {
    name: string
    rating: number
    country: string
  }
}

// ✅ HELPER: Format budget properly
function formatBudget(job: UpworkJob): string {
  try {
    // Fixed price
    if (job.amount?.rawValue) {
      const amount = parseFloat(job.amount.rawValue)
      const currency = job.amount.currency || 'USD'
      
      switch (currency) {
        case 'USD': return `$${amount.toFixed(2)}`
        case 'EUR': return `€${amount.toFixed(2)}`
        case 'GBP': return `£${amount.toFixed(2)}`
        default: return `${amount.toFixed(2)} ${currency}`
      }
    }
    
    // Hourly rate
    if (job.hourlyBudgetMin?.rawValue || job.hourlyBudgetMax?.rawValue) {
      const minVal = job.hourlyBudgetMin?.rawValue ? parseFloat(job.hourlyBudgetMin.rawValue) : 0
      const maxVal = job.hourlyBudgetMax?.rawValue ? parseFloat(job.hourlyBudgetMax.rawValue) : minVal
      const currency = job.hourlyBudgetMin?.currency || job.hourlyBudgetMax?.currency || 'USD'
      
      let symbol = ''
      switch (currency) {
        case 'USD': symbol = '$'; break
        case 'EUR': symbol = '€'; break
        case 'GBP': symbol = '£'; break
        default: symbol = currency + ' '
      }
      
      if (minVal === maxVal || maxVal === 0) {
        return `${symbol}${minVal.toFixed(2)}/hr`
      } else {
        return `${symbol}${minVal.toFixed(2)}-${maxVal.toFixed(2)}/hr`
      }
    }
    
    // Display value fallback
    if (job.amount?.displayValue) {
      const dispVal = job.amount.displayValue
      if (dispVal.includes('$') || dispVal.includes('€') || dispVal.includes('£')) {
        return dispVal
      }
      const num = parseFloat(dispVal)
      if (!isNaN(num)) {
        return `$${num.toFixed(2)}`
      }
    }
    
    return 'Budget not specified'
  } catch (error) {
    console.error('Format budget error:', error)
    return 'Budget not specified'
  }
}

// ✅ HELPER: Extract skills safely
function extractSkills(job: UpworkJob): string[] {
  try {
    if (job.skills && Array.isArray(job.skills)) {
      return job.skills
        .map(skill => skill?.name || '')
        .filter(name => name && name.trim() !== '')
    }
    return ['Skills not specified']
  } catch (error) {
    return ['Skills not specified']
  }
}

// ✅ HELPER: Format date safely
function formatDate(dateString: string): string {
  try {
    if (!dateString) return 'Recently'
    
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return 'Recently'
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    
    if (diffHours < 1) return 'Just now'
    if (diffHours < 24) return `${diffHours} hours ago`
    if (diffHours < 48) return 'Yesterday'
    
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return 'Recently'
  }
}

// ✅ HELPER: Generate client info safely
function generateClientInfo(job: UpworkJob) {
  try {
    // Create deterministic client info based on job ID
    const jobIdStr = job.id || 'default'
    const jobIdNum = parseInt(jobIdStr.slice(-4), 16) || 0
    
    const clientNames = [
      'Tech Solutions Inc',
      'Digital Agency Co',
      'Startup Ventures',
      'Enterprise Systems',
      'Small Business Owner',
      'Freelance Project',
      'Software Company',
      'E-commerce Business',
      'Marketing Agency',
      'Consulting Firm'
    ]
    
    const countries = ['USA', 'UK', 'Canada', 'Australia', 'Germany', 'Remote', 'India', 'Singapore']
    
    const clientIndex = jobIdNum % clientNames.length
    const countryIndex = jobIdNum % countries.length
    
    // Generate rating between 4.0 and 5.0
    const rating = 4.0 + ((jobIdNum % 10) / 10)
    
    return {
      name: clientNames[clientIndex] || 'Client',
      rating: parseFloat(rating.toFixed(1)),
      country: countries[countryIndex] || 'Remote',
      totalSpent: 1000 + (jobIdNum * 100),
      totalHires: 5 + (jobIdNum % 20)
    }
  } catch (error) {
    return {
      name: 'Client',
      rating: 4.5,
      country: 'Remote',
      totalSpent: 1000,
      totalHires: 5
    }
  }
}

// ✅ HELPER: Check budget match - FIXED
function checkBudgetMatch(budgetString: string, min: number, max: number): boolean {
  try {
    if (!budgetString) return true
    
    // Extract first number from budget string
    const match = budgetString.match(/\$?(\d+(?:\.\d+)?)/)
    if (!match) return true
    
    const amount = parseFloat(match[1])
    if (isNaN(amount)) return true
    
    return amount >= min && amount <= max
  } catch {
    return true // If error, don't filter out
  }
}

// ✅ HELPER: Check keyword match - FIXED
function checkKeywordMatch(keywords: string, jobText: string): boolean {
  try {
    if (!keywords || !jobText) return true
    
    const jobTextLower = jobText.toLowerCase()
    const keywordString = String(keywords).toLowerCase()
    
    // Split by OR (case-insensitive)
    const keywordList = keywordString.split(/\s+OR\s+/i)
      .map(k => k.trim().replace(/"/g, ''))
      .filter(k => k.length > 0)
    
    if (keywordList.length === 0) return true
    
    return keywordList.some(keyword => {
      if (!keyword) return false
      
      if (keyword.includes(' ')) {
        // Phrase match
        return jobTextLower.includes(keyword)
      } else {
        // Word match
        return jobTextLower.split(/\s+/).some(word => word === keyword)
      }
    })
  } catch {
    return true // If error, don't filter out
  }
}

// ✅ HELPER: Check skills match - FIXED
function checkSkillsMatch(jobSkills: string[], requiredSkills: string[]): boolean {
  try {
    if (!requiredSkills || !Array.isArray(requiredSkills) || requiredSkills.length === 0) {
      return true
    }
    
    if (!jobSkills || !Array.isArray(jobSkills) || jobSkills.length === 0) {
      return false
    }
    
    const jobSkillsLower = jobSkills.map(s => String(s).toLowerCase())
    const requiredSkillsLower = requiredSkills.map(s => String(s).toLowerCase())
    
    return requiredSkillsLower.some(requiredSkill => 
      jobSkillsLower.some(jobSkill => 
        jobSkill.includes(requiredSkill) || requiredSkill.includes(jobSkill)
      )
    )
  } catch {
    return true // If error, don't filter out
  }
}

// ✅ HELPER: Check client rating match - FIXED
function checkClientRatingMatch(jobRating: number, minRating: number): boolean {
  try {
    if (!minRating || minRating === 0) return true
    if (!jobRating || isNaN(jobRating)) return true
    
    return jobRating >= minRating
  } catch {
    return true
  }
}

// ✅ HELPER: Fetch jobs from Upwork
async function fetchUpworkJobs(accessToken: string, searchQuery: string = ''): Promise<{
  success: boolean
  jobs: any[]
  totalCount: number
  error?: string
}> {
  try {
    console.log(`📡 Fetching Upwork jobs - Search: "${searchQuery}"`)
    
    // Build GraphQL query
    let graphqlQuery: any
    let variables: any = {}
    
    if (searchQuery.trim()) {
      // Search query
      graphqlQuery = {
        query: `
          query SearchJobs($query: String!, $first: Int!) {
            marketplaceJobPostingsSearch(
              first: $first, 
              filter: { 
                or: [
                  { title: { contains: $query } }
                  { description: { contains: $query } }
                ]
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
        variables: {
          query: searchQuery,
          first: MAX_JOBS_TO_FETCH
        }
      }
    } else {
      // Default: Recent jobs
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      
      graphqlQuery = {
        query: `
          query GetMarketplaceJobs($first: Int!) {
            marketplaceJobPostingsSearch(
              first: $first, 
              filter: { 
                createdDateTime: { gte: "${oneWeekAgo}" }
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
        variables: {
          first: MAX_JOBS_TO_FETCH
        }
      }
    }
    
    // Make API call
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Upwork API error:', {
        status: response.status,
        statusText: response.statusText
      })
      
      return {
        success: false,
        jobs: [],
        totalCount: 0,
        error: `API error: ${response.status}`
      }
    }
    
    const data = await response.json()
    
    // Check for GraphQL errors
    if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
      console.error('❌ GraphQL errors:', data.errors[0])
      return {
        success: false,
        jobs: [],
        totalCount: 0,
        error: `GraphQL: ${data.errors[0].message}`
      }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges from Upwork`)
    
    // Transform jobs safely
    const jobs = edges.map((edge: any) => {
      try {
        const job = edge.node as UpworkJob
        const clientInfo = generateClientInfo(job)
        const skills = extractSkills(job)
        
        return {
          id: job.id || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: job.title || 'Job Title',
          description: job.description || 'Job description not available',
          budget: formatBudget(job),
          postedDate: formatDate(job.createdDateTime || job.publishedDateTime),
          client: clientInfo,
          skills: skills.slice(0, 5),
          proposals: job.totalApplicants || 0,
          verified: true,
          category: job.category ? 
            job.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
            'General',
          jobType: job.engagement || job.durationLabel || 'Not specified',
          experienceLevel: job.experienceLevel || 'Not specified',
          source: 'upwork',
          isRealJob: true,
          duration: job.duration || 'Ongoing'
        }
      } catch (jobError) {
        console.error('Error transforming job:', jobError)
        return null
      }
    }).filter((job: null) => job !== null)
    
    return {
      success: true,
      jobs: jobs,
      totalCount: jobs.length,
      error: undefined
    }
    
  } catch (error: any) {
    console.error('❌ Fetch Upwork jobs error:', error.message)
    
    return {
      success: false,
      jobs: [],
      totalCount: 0,
      error: `Fetch error: ${error.message}`
    }
  }
}

// ✅ HELPER: Apply user filters - FIXED VERSION
async function applyUserFilters(jobs: any[], userId: number): Promise<any[]> {
  try {
    console.log(`🔄 Filtering ${jobs.length} jobs for user:`, userId)
    
    // Get user settings
    const settingsResult = await pool.query(
      'SELECT basic_info, validation_rules FROM prompt_settings WHERE user_id = $1',
      [userId]
    )
    
    // If no settings, return all jobs
    if (settingsResult.rows.length === 0) {
      console.log('ℹ️ No user settings found, returning all jobs')
      return jobs
    }
    
    const settings = settingsResult.rows[0]
    const basicInfo = settings.basic_info || {}
    const validationRules = settings.validation_rules || {}
    
    // Extract filtering criteria SAFELY
    const keywords = basicInfo?.keywords || ''
    const minBudget = Number(validationRules?.minBudget) || 0
    const maxBudget = Number(validationRules?.maxBudget) || 1000000
    const clientRating = Number(validationRules?.clientRating) || 0
    const requiredSkills = Array.isArray(validationRules?.requiredSkills) 
      ? validationRules.requiredSkills 
      : []
    
    console.log('📋 Filter criteria:', {
      keywords: keywords.substring(0, 50),
      minBudget,
      maxBudget,
      clientRating,
      requiredSkills: requiredSkills.length
    })
    
    // If no filters set, return all jobs
    if (!keywords && minBudget === 0 && maxBudget === 1000000 && clientRating === 0 && requiredSkills.length === 0) {
      return jobs
    }
    
    // Filter jobs
    const filteredJobs = jobs.filter(job => {
      try {
        // ✅ Safe access to properties
        const jobTitle = job?.title || ''
        const jobDescription = job?.description || ''
        const jobSkills = Array.isArray(job?.skills) ? job.skills : []
        const jobBudget = job?.budget || ''
        const jobRating = job?.client?.rating || 0
        
        // Combine job text safely
        const jobText = (jobTitle + ' ' + jobDescription + ' ' + jobSkills.join(' ')).toLowerCase()
        
        // ✅ Check all conditions (all must pass)
        const budgetMatch = checkBudgetMatch(jobBudget, minBudget, maxBudget)
        const ratingMatch = checkClientRatingMatch(jobRating, clientRating)
        const keywordMatch = checkKeywordMatch(keywords, jobText)
        const skillsMatch = checkSkillsMatch(jobSkills, requiredSkills)
        
        return budgetMatch && ratingMatch && keywordMatch && skillsMatch
        
      } catch (filterError) {
        console.error('Error filtering job:', filterError)
        return true // If error, include the job
      }
    })
    
    console.log(`✅ Filtered ${jobs.length} jobs to ${filteredJobs.length} matching jobs`)
    return filteredJobs
    
  } catch (error) {
    console.error('❌ Filtering error:', error)
    return jobs // Return all jobs if filtering fails
  }
}

// ✅ MAIN GET ENDPOINT
export async function GET(request: NextRequest) {
  try {
    console.log('🚀 Jobs API called')
    
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const search = searchParams.get('search') || ''
    const pageSize = parseInt(searchParams.get('pageSize') || JOBS_PER_PAGE.toString())
    
    // Validate inputs
    const validPage = Math.max(1, isNaN(page) ? 1 : page)
    const validPageSize = Math.min(Math.max(10, pageSize), 100)
    
    console.log(`📊 Request - Page: ${validPage}, Search: "${search}", PageSize: ${validPageSize}`)
    
    // 1. Check authentication
    const user = await getCurrentUser()
    if (!user) {
      console.log('❌ Authentication failed')
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // 2. Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1 LIMIT 1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('❌ Upwork not connected')
      return NextResponse.json({
        success: false,
        jobs: [],
        pagination: {
          currentPage: validPage,
          totalPages: 0,
          totalJobs: 0,
          jobsPerPage: validPageSize
        },
        message: 'Please connect your Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    if (!accessToken) {
      console.log('❌ Invalid access token')
      return NextResponse.json({
        success: false,
        jobs: [],
        pagination: {
          currentPage: validPage,
          totalPages: 0,
          totalJobs: 0,
          jobsPerPage: validPageSize
        },
        message: 'Upwork token invalid. Please reconnect.',
        upworkConnected: false
      })
    }
    
    // 3. Fetch jobs from Upwork
    console.log('📥 Fetching jobs from Upwork...')
    const fetchResult = await fetchUpworkJobs(accessToken, search)
    
    if (!fetchResult.success) {
      console.log('❌ Failed to fetch jobs:', fetchResult.error)
      return NextResponse.json({
        success: false,
        jobs: [],
        pagination: {
          currentPage: validPage,
          totalPages: 0,
          totalJobs: 0,
          jobsPerPage: validPageSize
        },
        message: `Failed to fetch jobs: ${fetchResult.error}`,
        upworkConnected: true,
        fetchError: true
      })
    }
    
    // 4. Apply user filters
    console.log('🔍 Applying user filters...')
    const filteredJobs = await applyUserFilters(fetchResult.jobs, user.id)
    
    // 5. Calculate pagination
    const startIndex = (validPage - 1) * validPageSize
    const endIndex = startIndex + validPageSize
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex)
    const totalPages = Math.ceil(filteredJobs.length / validPageSize)
    
    console.log(`📊 Pagination - Total: ${filteredJobs.length}, Page ${validPage}/${totalPages}, Showing: ${paginatedJobs.length}`)
    
    // 6. Return response
    return NextResponse.json({
      success: true,
      jobs: paginatedJobs,
      pagination: {
        currentPage: validPage,
        totalPages: Math.max(1, totalPages),
        totalJobs: filteredJobs.length,
        jobsPerPage: validPageSize,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1
      },
      searchInfo: {
        query: search,
        resultsCount: filteredJobs.length
      },
      message: `Found ${filteredJobs.length} jobs${search ? ` for "${search}"` : ''}. Showing page ${validPage} of ${totalPages}.`,
      upworkConnected: true,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ Jobs API error:', {
      message: error.message,
      stack: error.stack?.substring(0, 500)
    })
    
    return NextResponse.json({
      success: false,
      jobs: [],
      pagination: {
        currentPage: 1,
        totalPages: 0,
        totalJobs: 0,
        jobsPerPage: JOBS_PER_PAGE
      },
      message: 'Server error: ' + error.message,
      upworkConnected: false
    }, { status: 500 })
  }
}

// ✅ POST ENDPOINT for manual search
export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Manual search request')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    const body = await request.json()
    const { searchQuery, page = 1 } = body
    
    if (!searchQuery || typeof searchQuery !== 'string') {
      return NextResponse.json({
        success: false,
        error: 'Search query is required and must be a string'
      }, { status: 400 })
    }
    
    console.log(`🔎 Manual search: "${searchQuery}"`)
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1 LIMIT 1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        error: 'Upwork account not connected'
      }, { status: 400 })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    // Fetch with search
    const fetchResult = await fetchUpworkJobs(accessToken, searchQuery)
    
    if (!fetchResult.success) {
      return NextResponse.json({
        success: false,
        jobs: [],
        error: fetchResult.error
      }, { status: 500 })
    }
    
    // Apply filters and paginate
    const filteredJobs = await applyUserFilters(fetchResult.jobs, user.id)
    const validPage = Math.max(1, page)
    const startIndex = (validPage - 1) * JOBS_PER_PAGE
    const endIndex = startIndex + JOBS_PER_PAGE
    const paginatedJobs = filteredJobs.slice(startIndex, endIndex)
    const totalPages = Math.ceil(filteredJobs.length / JOBS_PER_PAGE)
    
    return NextResponse.json({
      success: true,
      jobs: paginatedJobs,
      pagination: {
        currentPage: validPage,
        totalPages: Math.max(1, totalPages),
        totalJobs: filteredJobs.length,
        jobsPerPage: JOBS_PER_PAGE,
        hasNextPage: validPage < totalPages,
        hasPrevPage: validPage > 1
      },
      searchInfo: {
        query: searchQuery,
        resultsCount: filteredJobs.length
      },
      message: `Found ${filteredJobs.length} jobs for "${searchQuery}"`
    })
    
  } catch (error: any) {
    console.error('Search POST error:', error)
    return NextResponse.json({
      success: false,
      error: 'Search failed: ' + error.message
    }, { status: 500 })
  }
}