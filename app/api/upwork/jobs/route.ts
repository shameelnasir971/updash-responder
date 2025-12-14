// app/api/upwork/jobs/route.ts 
// app/api/upwork/jobs/route.ts - PURA REAL DATA VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching 100% REAL jobs from Upwork API...')
    
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
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
                client {
                  ... on Client {
                    id
                    firstName
                    lastName
                    displayName
                    location {
                      country
                    }
                    stats {
                      totalSpent
                      totalHires
                      totalPostedJobs
                      avgHourlyRatePaid
                    }
                    reviews {
                      avgRating
                      totalReviews
                    }
                  }
                }
                freelancerLocationRestriction {
                  countries
                }
                skills {
                  name
                  id
                }
                totalApplicants
                category {
                  id
                  title
                }
                createdDateTime
                publishedDateTime
                experienceLevel
                engagement {
                  id
                  name
                }
                duration {
                  id
                  label
                }
                durationLabel
                jobVisibility
                jobStatus
                weeklyHours
                tier
                preferredLocation
                freelancerLocation
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
        'Accept': 'application/json'
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Upwork API Response Status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Upwork API error response:', errorText.substring(0, 500))
      return { success: false, error: `API request failed: ${response.status}`, jobs: [] }
    }
    
    const data = await response.json()
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { success: false, error: data.errors[0]?.message || 'GraphQL error', jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Received ${edges.length} real job edges from Upwork`)
    
    // ✅ SIRF REAL DATA FORMAT KARO - KOI MOCK INFO NAHI
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      const client = node.client || {}
      const reviews = client.reviews || {}
      const stats = client.stats || {}
      const location = client.location || {}
      
      // ✅ BUDGET - Real data se format karo
      let budgetText = 'Not specified'
      
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        
        if (currency === 'USD') budgetText = `$${rawValue.toFixed(2)}`
        else if (currency === 'EUR') budgetText = `€${rawValue.toFixed(2)}`
        else if (currency === 'GBP') budgetText = `£${rawValue.toFixed(2)}`
        else budgetText = `${rawValue.toFixed(2)} ${currency}`
      }
      else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
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
      }
      else if (node.amount?.displayValue) {
        budgetText = node.amount.displayValue
      }
      
      // ✅ REAL CLIENT DATA - koi mock info nahi
      const clientName = client.displayName || 
                        (client.firstName && client.lastName ? `${client.firstName} ${client.lastName}` : 'Client') || 
                        'Client'
      
      // ✅ REAL DATE
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently'
      
      // ✅ REAL SKILLS
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      return {
        // ✅ CORE JOB DATA (Real from Upwork)
        id: node.id || `job_${Date.now()}_${Math.random()}`,
        title: node.title || 'Untitled Job',
        description: node.description || 'No description provided.',
        budget: budgetText,
        postedDate: formattedDate,
        
        // ✅ 100% REAL CLIENT DATA (Jaisa Upwork API se aaya)
        client: {
          name: clientName, // REAL NAME
          rating: reviews.avgRating || 0, // REAL RATING (0 if not available)
          country: location.country || 'Not specified', // REAL COUNTRY
          totalSpent: stats.totalSpent || 0, // REAL TOTAL SPENT
          totalHires: stats.totalHires || 0, // REAL TOTAL HIRES
          totalReviews: reviews.totalReviews || 0, // REAL REVIEW COUNT
          avgHourlyRatePaid: stats.avgHourlyRatePaid || 0 // REAL HOURLY RATE
        },
        
        // ✅ OTHER REAL DATA
        skills: realSkills,
        proposals: node.totalApplicants || 0,
        verified: node.jobStatus === 'ACTIVE', // Real verification status
        category: node.category?.title || 'General',
        jobType: node.engagement?.name || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        duration: node.duration?.label || 'Not specified',
        weeklyHours: node.weeklyHours || 'Not specified',
        preferredLocation: node.preferredLocation || 'Remote',
        freelancerLocation: node.freelancerLocation || 'Anywhere',
        
        // Metadata
        source: 'upwork',
        isRealJob: true,
        visibility: node.jobVisibility,
        tier: node.tier,
        
        // Debug info (temporary)
        _debug: {
          hasClientData: !!client.id,
          hasBudgetData: !!(node.amount || node.hourlyBudgetMin || node.hourlyBudgetMax),
          rawClientId: client.id || 'none'
        }
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} jobs with 100% REAL data`)
    
    // Log first job for verification
    if (jobs.length > 0) {
      const sampleJob = jobs[0]
      console.log('🔍 SAMPLE REAL JOB (First one):', {
        id: sampleJob.id,
        title: sampleJob.title.substring(0, 50),
        client: sampleJob.client.name,
        rating: sampleJob.client.rating,
        country: sampleJob.client.country,
        budget: sampleJob.budget
      })
    }
    
    return { success: true, jobs: jobs, error: null }
    
  } catch (error: any) {
    console.error('❌ fetchRealUpworkJobs error:', error.message)
    console.error('Error stack:', error.stack)
    return { success: false, error: error.message, jobs: [] }
  }
}

export async function GET() {
  try {
    console.log('=== /api/upwork/jobs called - REAL DATA VERSION ===')
    
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
        message: 'Please connect your Upwork account first',
        upworkConnected: false,
        dataQuality: 'No access token'
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    if (!accessToken || accessToken === '') {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Upwork access token is empty',
        upworkConnected: false,
        dataQuality: 'Invalid token'
      })
    }
    
    const result = await fetchRealUpworkJobs(accessToken)
    
    if (!result.success) {
      console.error('❌ Failed to fetch jobs:', result.error)
    }
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success ? 
        `✅ SUCCESS: ${result.jobs.length} REAL jobs loaded from Upwork API` : 
        `❌ ERROR: ${result.error}`,
      upworkConnected: true,
      dataQuality: result.success ? '100% REAL data - no mock information' : 'Fetch failed',
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ Main /jobs endpoint error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      total: 0,
      message: `Server error: ${error.message}`,
      upworkConnected: false,
      dataQuality: 'Server error'
    }, { status: 500 })
  }
}