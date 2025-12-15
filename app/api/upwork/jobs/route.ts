// app/api/upwork/jobs/route.ts 
// app/api/upwork/jobs/route.ts - 100% REAL DATA VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ REAL Upwork Jobs Fetch Function - NO MOCK DATA
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching 100% REAL jobs from Upwork API...')
    
    // ✅ COMPLETE GraphQL Query with ALL REAL CLIENT DATA
    const graphqlQuery = {
      query: `
        query GetRealMarketplaceJobs {
          marketplaceJobPostingsSearch(
            first: 50,
            filter: { 
              category: ["Web Development", "Mobile Development", "Design & Creative", "Admin Support", "Accounting & Consulting"]
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
                  importance
                }
                totalApplicants
                category
                subcategory
                createdDateTime
                publishedDateTime
                experienceLevel
                engagement
                duration
                durationLabel
                # ✅ REAL CLIENT DATA - No Mock
                client {
                  id
                  displayName
                  firstName
                  lastName
                  location {
                    city
                    state
                    country
                  }
                  company {
                    name
                    size
                    industry
                  }
                  stats {
                    avgRating
                    totalSpent
                    totalHires
                    totalJobsPosted
                    totalHours
                  }
                  verificationStatus
                  membershipDate
                }
                # ✅ JOB SPECIFIC REAL DATA
                jobType
                jobStatus
                estimatedWorkload
                preferredLocation
                englishLevel
                contractToHire
                featured
                recno
                # ✅ BUDGET AND PAYMENT
                budgetType
                budgetAmount {
                  amount
                  currency
                }
                hourlyRate {
                  min
                  max
                  currency
                }
                # ✅ ADDITIONAL JOB DETAILS
                qualifications
                responsibilities
                applicantRequirements
                screeningQuestions {
                  question
                  type
                }
              }
            }
            pageInfo {
              hasNextPage
              endCursor
            }
            totalCount
          }
        }
      `
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Upwork API Response Status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Upwork API Error:', errorText.substring(0, 300))
      return { success: false, error: `API request failed: ${response.status}`, jobs: [] }
    }
    
    const data = await response.json()
    
    // ✅ DEBUG: Check if we're getting real client data
    if (data.data?.marketplaceJobPostingsSearch?.edges?.[0]?.node?.client) {
      const firstClient = data.data.marketplaceJobPostingsSearch.edges[0].node.client
      console.log('✅ REAL CLIENT DATA RECEIVED:', {
        name: firstClient.displayName || firstClient.firstName + ' ' + firstClient.lastName,
        company: firstClient.company?.name,
        country: firstClient.location?.country,
        rating: firstClient.stats?.avgRating,
        spent: firstClient.stats?.totalSpent,
        hires: firstClient.stats?.totalHires
      })
    }
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges with REAL data`)
    
    // ✅ Format jobs with 100% REAL DATA - NO MOCKING
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      const client = node.client || {}
      const location = client.location || {}
      const stats = client.stats || {}
      const company = client.company || {}
      
      // ✅ REAL BUDGET FORMATTING (same as before)
      let budgetText = 'Budget not specified'
      
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        budgetText = formatCurrency(rawValue, currency)
      } else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
        const minVal = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : 0
        const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal
        const currency = node.hourlyBudgetMin?.currency || node.hourlyBudgetMax?.currency || 'USD'
        budgetText = formatHourlyRate(minVal, maxVal, currency)
      } else if (node.amount?.displayValue) {
        budgetText = node.amount.displayValue
      }
      
      // ✅ REAL SKILLS
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
      
      // ✅ REAL CATEGORY
      const category = node.category || 'General'
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      // ✅ 100% REAL CLIENT DATA - NO MOCKING
      const realClient = {
        // ✅ REAL CLIENT NAME
        name: client.displayName || 
              (client.firstName && client.lastName ? `${client.firstName} ${client.lastName}` : '') ||
              company.name || 
              'Upwork Client', // Only as last resort
        
        // ✅ REAL RATING (null if not available)
        rating: stats.avgRating || null,
        
        // ✅ REAL COUNTRY
        country: location.country || null,
        
        // ✅ REAL TOTAL SPENT
        totalSpent: stats.totalSpent || null,
        
        // ✅ REAL TOTAL HIRES
        totalHires: stats.totalHires || null,
        
        // ✅ ADDITIONAL REAL DATA
        city: location.city,
        state: location.state,
        companyName: company.name,
        companySize: company.size,
        industry: company.industry,
        verificationStatus: client.verificationStatus,
        membershipDate: client.membershipDate,
        totalJobsPosted: stats.totalJobsPosted,
        totalHours: stats.totalHours
      }
      
      // ✅ Remove null values from client object
      const cleanClient = Object.fromEntries(
        Object.entries(realClient).filter(([_, v]) => v != null)
      )
      
      return {
        id: node.id,
        title: node.title || 'Job',
        description: node.description || 'No description available',
        budget: budgetText,
        postedDate: formattedDate,
        client: cleanClient, // ✅ 100% REAL CLIENT DATA
        skills: realSkills.slice(0, 5),
        proposals: realProposals,
        category: cleanedCategory,
        jobType: node.engagement || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        duration: node.duration,
        estimatedWorkload: node.estimatedWorkload,
        preferredLocation: node.preferredLocation,
        englishLevel: node.englishLevel,
        contractToHire: node.contractToHire,
        featured: node.featured,
        source: 'upwork',
        // ✅ REMOVED: verified, isRealJob, _debug_budget - No mock fields
        // ✅ Only real data from API
        rawClientData: client, // Optional: for debugging
        rawJobData: { // Optional: for debugging
          hasClientData: !!client,
          hasBudgetData: !!(node.amount || node.hourlyBudgetMin),
          skillsCount: realSkills.length
        }
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} jobs with 100% REAL data`)
    
    // ✅ Show sample of real client data
    if (jobs.length > 0) {
      console.log('👤 REAL CLIENT DATA SAMPLES:')
      jobs.slice(0, 3).forEach((job: any, i: number) => {
        console.log(`  Job ${i+1}: ${job.client.name} from ${job.client.country || 'Unknown'} (Rating: ${job.client.rating || 'N/A'})`)
      })
    }
    
    return { success: true, jobs: jobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// ✅ Helper: Format currency
function formatCurrency(amount: number, currency: string): string {
  const symbols: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'INR': '₹',
    'AUD': 'A$',
    'CAD': 'C$'
  }
  
  const symbol = symbols[currency] || currency + ' '
  return `${symbol}${amount.toFixed(2)}`
}

// ✅ Helper: Format hourly rate
function formatHourlyRate(min: number, max: number, currency: string): string {
  const symbol = formatCurrency(1, currency).replace('1.00', '')
  
  if (min === max || max === 0) {
    return `${symbol}${min.toFixed(2)}/hr`
  } else {
    return `${symbol}${min.toFixed(2)}-${max.toFixed(2)}/hr`
  }
}

// ✅ Main GET Endpoint
export async function GET() {
  try {
    console.log('=== JOBS API: 100% REAL DATA VERSION ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('User:', user.email)
    
    // ✅ Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('❌ No Upwork account connected')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Please connect your Upwork account first',
        upworkConnected: false,
        dataQuality: 'No access - Connect Upwork'
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    if (!accessToken) {
      console.log('❌ No access token found')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Upwork access token missing. Please reconnect.',
        upworkConnected: false,
        dataQuality: 'Token missing'
      })
    }
    
    console.log('✅ Access token found, fetching REAL jobs...')
    
    const result = await fetchRealUpworkJobs(accessToken)
    
    if (!result.success) {
      console.error('❌ Failed to fetch jobs:', result.error)
      
      // ✅ NO MOCK DATA - Return empty with error
      return NextResponse.json({
        success: false,
        jobs: [],
        message: `Failed to fetch jobs: ${result.error}`,
        upworkConnected: true,
        dataQuality: 'API Error - No mock data returned'
      })
    }
    
    // ✅ SUCCESS: 100% REAL DATA
    const realJobsCount = result.jobs.length
    const jobsWithRealClient = result.jobs.filter((job: any) => job.client.name && job.client.name !== 'Upwork Client').length
    
    console.log(`🎉 SUCCESS: ${realJobsCount} real jobs, ${jobsWithRealClient} with identifiable clients`)
    
    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      total: realJobsCount,
      message: `✅ SUCCESS: ${realJobsCount} jobs with 100% REAL data (${jobsWithRealClient} with real client info)`,
      upworkConnected: true,
      dataQuality: '100% Real - No mock data',
      stats: {
        totalJobs: realJobsCount,
        jobsWithClientInfo: jobsWithRealClient,
        jobsWithBudget: result.jobs.filter((j: any) => j.budget !== 'Budget not specified').length,
        avgProposals: result.jobs.reduce((sum: number, j: any) => sum + (j.proposals || 0), 0) / realJobsCount || 0
      }
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    
    // ✅ NO MOCK DATA ON ERROR - Return empty array
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message,
      dataQuality: 'Error - No mock data returned'
    }, { status: 500 })
  }
}