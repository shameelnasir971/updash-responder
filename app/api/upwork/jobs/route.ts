// app/api/upwork/jobs/route.ts 
// app/api/upwork/jobs/route.ts - REAL DATA ONLY VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching REAL Upwork jobs with complete client data...')
    
    // ✅ REAL GraphQL Query with ALL client fields
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobsWithClient {
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
                createdDateTime
                publishedDateTime
                experienceLevel
                engagement
                duration
                durationLabel
                # ✅ REAL CLIENT DATA FROM UPWORK
                client {
                  id
                  name
                  displayName
                  rating
                  reviewsCount
                  location {
                    country
                    city
                  }
                  totalSpent
                  totalHires
                  totalJobsPosted
                  avgHourlyRatePaid
                  memberSince
                  # ✅ ADDITIONAL REAL FIELDS
                  company
                  jobPostSuccess
                  profilePhotoUrl
                  status
                }
                # ✅ JOB SPECIFIC FIELDS
                jobType
                budgetType
                workload
                talentLocation
                connectRequired
                verificationStatus
                # ✅ FEE STRUCTURE
                freelancerServiceFeePercentage
                preferredFreelancerLocation
                isTopRated
                isFeatured
              }
            }
          }
        }
      `
    }
    
    console.log('🔗 Making GraphQL request to Upwork...')
    
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
      console.error('❌ API error:', error.substring(0, 300))
      return { success: false, error: 'API request failed', jobs: [] }
    }
    
    const data = await response.json()
    
    // ✅ DEBUG: Check if we're getting real client data
    if (data.data?.marketplaceJobPostingsSearch?.edges?.[0]?.node?.client) {
      const firstClient = data.data.marketplaceJobPostingsSearch.edges[0].node.client
      console.log('✅ REAL CLIENT DATA RECEIVED:', {
        name: firstClient.name || firstClient.displayName,
        rating: firstClient.rating,
        country: firstClient.location?.country,
        totalSpent: firstClient.totalSpent,
        totalHires: firstClient.totalHires,
        hasRealData: !firstClient.name?.includes('Enterprise') // Check for mock patterns
      })
    }
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges with REAL data`)
    
    // ✅ REAL DATA FORMATTING - NO MOCK, NO FABRICATION
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      const client = node.client || {}
      const location = client.location || {}
      
      // ✅ REAL BUDGET FORMATTING
      let budgetText = 'Budget not specified'
      
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        budgetText = formatBudget(rawValue, currency, 'fixed')
      } else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
        const minVal = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : 0
        const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal
        const currency = node.hourlyBudgetMin?.currency || node.hourlyBudgetMax?.currency || 'USD'
        budgetText = formatBudget(minVal, currency, 'hourly', maxVal)
      } else if (node.amount?.displayValue) {
        budgetText = node.amount.displayValue
      }
      
      // ✅ REAL SKILLS (no fabrication)
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // ✅ REAL PROPOSAL COUNT
      const realProposals = node.totalApplicants || 0
      
      // ✅ REAL POSTED DATE
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently'
      
      // ✅ REAL CATEGORY (no cleaning needed - use as is)
      const category = node.category || ''
      
      // ✅ REAL CLIENT DATA (NO MOCK, NO FABRICATION)
      // If Upwork doesn't provide certain fields, we leave them null/undefined
      const clientData = {
        name: client.name || client.displayName || client.company || 'Client',
        rating: client.rating || null,
        country: location.country || null,
        city: location.city || null,
        totalSpent: client.totalSpent || null,
        totalHires: client.totalHires || null,
        totalJobsPosted: client.totalJobsPosted || null,
        memberSince: client.memberSince || null,
        profilePhotoUrl: client.profilePhotoUrl || null,
        // ✅ ADD REAL FIELDS THAT UPWORK PROVIDES
        reviewsCount: client.reviewsCount || 0,
        avgHourlyRatePaid: client.avgHourlyRatePaid || null,
        jobPostSuccess: client.jobPostSuccess || null,
        status: client.status || null
      }
      
      return {
        id: node.id,
        title: node.title || '',
        description: node.description || '',
        budget: budgetText,
        postedDate: formattedDate,
        client: clientData,
        skills: realSkills,
        proposals: realProposals,
        verified: node.verificationStatus || node.isTopRated || false,
        category: category,
        jobType: node.engagement || node.durationLabel || node.jobType || '',
        experienceLevel: node.experienceLevel || '',
        source: 'upwork',
        isRealJob: true,
        // ✅ Job-specific real fields
        workload: node.workload || '',
        talentLocation: node.talentLocation || '',
        connectRequired: node.connectRequired || false,
        freelancerServiceFeePercentage: node.freelancerServiceFeePercentage || null,
        preferredFreelancerLocation: node.preferredFreelancerLocation || '',
        isFeatured: node.isFeatured || false
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} jobs with 100% REAL data`)
    
    // Filter out any jobs that might still have mock patterns
    const filteredJobs = jobs.filter((job: { client: { name: string } }) => {
      const clientName = job.client.name || ''
      const mockPatterns = [
        'Enterprise Client', 'Tech Solutions Inc', 'Digital Agency', 
        'Startup Company', 'Small Business', 'Freelance Client'
      ]
      return !mockPatterns.some(pattern => clientName.includes(pattern))
    })
    
    console.log(`✅ After mock filter: ${filteredJobs.length} pure real jobs`)
    
    return { success: true, jobs: filteredJobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// Helper function for budget formatting
function formatBudget(value: number, currency: string, type: 'fixed' | 'hourly', maxVal?: number): string {
  const currencySymbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'AUD': 'A$',
    'CAD': 'C$',
    'INR': '₹'
  }
  
  const symbol = currencySymbols[currency] || (currency + ' ')
  
  if (type === 'fixed') {
    return `${symbol}${value.toFixed(2)}`
  } else {
    if (maxVal && maxVal > value) {
      return `${symbol}${value.toFixed(2)}-${maxVal.toFixed(2)}/hr`
    }
    return `${symbol}${value.toFixed(2)}/hr`
  }
}

export async function GET() {
  try {
    console.log('=== UPDATED JOBS API: 100% REAL DATA ONLY ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('User:', user.email)
    
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('⚠️ No Upwork connection found')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Connect Upwork account first to see real jobs',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    if (!accessToken) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Upwork access token missing',
        upworkConnected: false
      })
    }
    
    console.log('✅ Access token found, fetching REAL jobs...')
    
    const result = await fetchRealUpworkJobs(accessToken)
    
    // ✅ If no jobs, return empty array - NO MOCK DATA
    if (result.jobs.length === 0) {
      return NextResponse.json({
        success: true,
        jobs: [],
        total: 0,
        message: 'No jobs available right now. Try again later.',
        upworkConnected: true,
        dataQuality: '100% Real - No mock data'
      })
    }
    
    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      total: result.jobs.length,
      message: `✅ SUCCESS: ${result.jobs.length} REAL jobs loaded from Upwork (0% mock)`,
      upworkConnected: true,
      dataQuality: '100% Real - Direct from Upwork API'
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [], // ✅ Return empty array, not mock
      message: 'Error loading jobs: ' + error.message,
      dataQuality: 'Real data only - Error occurred'
    }, { status: 500 })
  }
}