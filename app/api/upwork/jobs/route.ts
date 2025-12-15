// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ UPDATED: Pure Real Data Fetch (No Mock)
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching REAL jobs with REAL client data...')
    
    // ✅ UPDATED GraphQL Query with Client Details
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
                client {
                  id
                  name
                  rating
                  location {
                    country
                    city
                  }
                  totalSpent
                  totalHires
                  paymentVerified
                  reviewsCount
                  memberSince
                }
                jobType
                workload
                contractTier
                clientActivity
                preferredLocation {
                  country
                }
                verificationStatus
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
    console.log(`✅ Found ${edges.length} job edges with REAL client data`)
    
    // ✅ Format jobs with ONLY REAL DATA
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      const client = node.client || {}
      
      // ✅ REAL Budget Formatting (Same as before)
      let budgetText = 'Budget not specified'
      
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        
        if (currency === 'USD') budgetText = `$${rawValue.toFixed(2)}`
        else if (currency === 'EUR') budgetText = `€${rawValue.toFixed(2)}`
        else if (currency === 'GBP') budgetText = `£${rawValue.toFixed(2)}`
        else budgetText = `${rawValue.toFixed(2)} ${currency}`
      } else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
        const minVal = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : 0
        const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal
        const currency = node.hourlyBudgetMin?.currency || node.hourlyBudgetMax?.currency || 'USD'
        
        let currencySymbol = ''
        if (currency === 'USD') currencySymbol = '$'
        else if (currency === 'EUR') currencySymbol = '€'
        else if (currency === 'GBP') currencySymbol = '£'
        else currencySymbol = currency + ' '
        
        if (minVal === maxVal || maxVal === 0) {
          budgetText = `${currencySymbol}${minVal.toFixed(2)}/hr`
        } else {
          budgetText = `${currencySymbol}${minVal.toFixed(2)}-${maxVal.toFixed(2)}/hr`
        }
      } else if (node.amount?.displayValue) {
        const dispVal = node.amount.displayValue
        if (dispVal.includes('$') || dispVal.includes('€') || dispVal.includes('£')) {
          budgetText = dispVal
        } else if (!isNaN(parseFloat(dispVal))) {
          budgetText = `$${parseFloat(dispVal).toFixed(2)}`
        }
      }
      
      // ✅ REAL Skills
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // ✅ REAL Proposal Count
      const realProposals = node.totalApplicants || 0
      
      // ✅ REAL Posted Date
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently'
      
      // ✅ REAL Category
      const category = node.category || 'General'
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      // ✅ REAL Client Data (NO MOCK!)
      const clientName = client.name || 'Client'
      const clientRating = client.rating || 0
      const clientCountry = client.location?.country || client.preferredLocation?.country || 'Remote'
      const clientTotalSpent = client.totalSpent || 0
      const clientTotalHires = client.totalHires || 0
      const paymentVerified = client.paymentVerified || node.verificationStatus === 'VERIFIED'
      
      // ✅ Job Type Formatting
      let jobType = 'Not specified'
      if (node.engagement) jobType = node.engagement
      else if (node.durationLabel) jobType = node.durationLabel
      
      // ✅ Experience Level Formatting
      let experienceLevel = 'Not specified'
      if (node.experienceLevel) {
        experienceLevel = node.experienceLevel.toLowerCase().replace('_', ' ')
        experienceLevel = experienceLevel.charAt(0).toUpperCase() + experienceLevel.slice(1)
      }
      
      // ✅ Workload/Est. Time
      let workloadText = 'Not specified'
      if (node.workload) workloadText = node.workload
      else if (node.duration) workloadText = node.duration
      
      return {
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || 'Job Description',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: clientName,  // ✅ REAL
          rating: clientRating,  // ✅ REAL
          country: clientCountry,  // ✅ REAL
          totalSpent: clientTotalSpent,  // ✅ REAL
          totalHires: clientTotalHires,  // ✅ REAL
          paymentVerified: paymentVerified,  // ✅ REAL
          reviewsCount: client.reviewsCount || 0,
          memberSince: client.memberSince || null
        },
        skills: realSkills,
        proposals: realProposals,
        verified: paymentVerified,
        category: cleanedCategory,
        jobType: jobType,
        experienceLevel: experienceLevel,
        workload: workloadText,
        contractTier: node.contractTier || 'Not specified',
        clientActivity: node.clientActivity || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        _debug_real: true  // Confirm no mock data
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} jobs with 100% REAL data`)
    
    // Debug log first job's client data
    if (jobs.length > 0) {
      console.log('👤 FIRST JOB REAL CLIENT DATA:', {
        name: jobs[0].client.name,
        rating: jobs[0].client.rating,
        country: jobs[0].client.country,
        totalSpent: jobs[0].client.totalSpent,
        totalHires: jobs[0].client.totalHires
      })
    }
    
    return { success: true, jobs: jobs, error: null }
    
  } catch (error: any) {
    console.error('Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

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
    
    if (!result.success) {
      // ✅ Agar API fail ho, toh EMPTY ARRAY return karo, MOCK DATA nahi
      return NextResponse.json({
        success: false,
        jobs: [],
        message: `Error fetching jobs: ${result.error}`,
        upworkConnected: true,
        dataQuality: 'Failed to fetch real data'
      })
    }
    
    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      total: result.jobs.length,
      message: `✅ SUCCESS: ${result.jobs.length} jobs with 100% REAL data (NO MOCK)`,
      upworkConnected: true,
      dataQuality: '100% Real Upwork API Data',
      _metadata: {
        mockDataPresent: false,
        realClientData: true,
        source: 'Upwork GraphQL API'
      }
    })
    
  } catch (error: any) {
    console.error('Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message,
      dataQuality: 'Error - No data returned'
    }, { status: 500 })
  }
}