// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ FIXED: Only use REAL available data from Upwork API
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching REAL jobs with safe query...')
    
    // ✅ SIMPLE & SAFE GraphQL Query (Only fields that definitely exist)
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
                # Client basic info (if available)
                client {
                  name
                  rating
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
    
    // ✅ DEBUG: Dekhein API kya return kar rahi hai
    if (data.data?.marketplaceJobPostingsSearch?.edges?.[0]) {
      const sampleNode = data.data.marketplaceJobPostingsSearch.edges[0].node
      console.log('🔍 SAMPLE API RESPONSE:', {
        hasClientField: !!sampleNode.client,
        clientFields: sampleNode.client ? Object.keys(sampleNode.client) : 'No client field',
        verificationStatus: sampleNode.verificationStatus
      })
    }
    
    if (data.errors) {
      console.error('GraphQL errors:', data.errors)
      // Agar client field error de raha hai, toh usko remove karke try karte hain
      if (data.errors[0]?.message?.includes('client')) {
        console.log('⚠️ Client field error, trying without client field...')
        
        // Try query without client field
        const safeQuery = {
          query: `
            query GetMarketplaceJobs {
              marketplaceJobPostingsSearch {
                edges {
                  node {
                    id
                    title
                    description
                    amount { rawValue currency displayValue }
                    hourlyBudgetMin { rawValue currency displayValue }
                    hourlyBudgetMax { rawValue currency displayValue }
                    skills { name }
                    totalApplicants
                    category
                    createdDateTime
                    publishedDateTime
                    experienceLevel
                    engagement
                    duration
                    durationLabel
                    verificationStatus
                  }
                }
              }
            }
          `
        }
        
        const safeResponse = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(safeQuery)
        })
        
        if (safeResponse.ok) {
          const safeData = await safeResponse.json()
          if (!safeData.errors) {
            console.log('✅ Query without client field worked!')
            data.data = safeData.data
          }
        }
      }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)
    
    // ✅ Format jobs with ONLY REAL AVAILABLE DATA
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // ✅ REAL Budget Formatting
      let budgetText = 'Budget not specified'
      let hourlyRateText = ''
      let isHourly = false
      
      // Fixed price job
      if (node.amount?.rawValue) {
        const rawValue = parseFloat(node.amount.rawValue)
        const currency = node.amount.currency || 'USD'
        
        if (currency === 'USD') budgetText = `$${rawValue.toFixed(2)}`
        else if (currency === 'EUR') budgetText = `€${rawValue.toFixed(2)}`
        else if (currency === 'GBP') budgetText = `£${rawValue.toFixed(2)}`
        else budgetText = `${rawValue.toFixed(2)} ${currency}`
      } 
      // Hourly job
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
          hourlyRateText = `${currencySymbol}${minVal.toFixed(2)}/hr`
        } else {
          hourlyRateText = `${currencySymbol}${minVal.toFixed(2)}-${maxVal.toFixed(2)}/hr`
        }
        budgetText = hourlyRateText
        isHourly = true
      } 
      // Display value fallback
      else if (node.amount?.displayValue) {
        const dispVal = node.amount.displayValue
        if (dispVal.includes('$') || dispVal.includes('€') || dispVal.includes('£')) {
          budgetText = dispVal
        } else if (!isNaN(parseFloat(dispVal))) {
          budgetText = `$${parseFloat(dispVal).toFixed(2)}`
        }
      }
      
      // ✅ REAL Skills (Upwork format)
      const realSkills = node.skills?.map((s: any) => s.name).filter(Boolean) || []
      
      // ✅ REAL Proposal Count (exact Upwork terminology)
      const realProposals = node.totalApplicants || 0
      
      // ✅ REAL Posted Date (Upwork style)
      const postedDate = node.createdDateTime || node.publishedDateTime
      let timeAgo = 'Recently'
      if (postedDate) {
        const postDate = new Date(postedDate)
        const now = new Date()
        const diffMs = now.getTime() - postDate.getTime()
        const diffMins = Math.floor(diffMs / 60000)
        const diffHours = Math.floor(diffMins / 60)
        const diffDays = Math.floor(diffHours / 24)
        
        if (diffMins < 60) {
          timeAgo = `${diffMins} minutes ago`
        } else if (diffHours < 24) {
          timeAgo = `${diffHours} hours ago`
        } else if (diffDays === 1) {
          timeAgo = '1 day ago'
        } else if (diffDays < 30) {
          timeAgo = `${diffDays} days ago`
        } else {
          timeAgo = postDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          })
        }
      }
      
      // ✅ REAL Category (Upwork format)
      const category = node.category || 'General'
      const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      
      // ✅ REAL Job Type (Upwork format)
      let jobType = 'Not specified'
      if (node.engagement) {
        jobType = node.engagement.replace(/_/g, ' ')
        jobType = jobType.charAt(0).toUpperCase() + jobType.slice(1).toLowerCase()
      } else if (node.durationLabel) {
        jobType = node.durationLabel
      }
      
      // ✅ REAL Experience Level (Upwork format)
      let experienceLevel = 'Not specified'
      if (node.experienceLevel) {
        experienceLevel = node.experienceLevel.toLowerCase().replace(/_/g, ' ')
        experienceLevel = experienceLevel.charAt(0).toUpperCase() + experienceLevel.slice(1)
      }
      
      // ✅ REAL Client Data (if available, otherwise minimal)
      const clientName = node.client?.name || 'Client'
      const clientRating = node.client?.rating || 0
      
      // ✅ Workload/Duration (Upwork format)
      let workload = 'Not specified'
      if (node.duration) {
        workload = node.duration.replace(/_/g, ' ')
        workload = workload.charAt(0).toUpperCase() + workload.slice(1).toLowerCase()
      }
      
      // ✅ Verification Status (Real from API)
      const isVerified = node.verificationStatus === 'VERIFIED' || false
      
      return {
        // ✅ REAL DATA FROM UPWORK API
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || 'Job Description',
        budget: budgetText,
        isHourly: isHourly,
        hourlyRate: hourlyRateText,
        postedDate: timeAgo,
        
        // Client info (as much as API provides)
        client: {
          name: clientName,
          rating: clientRating,
          // These fields are NOT available in job search API
          // So we don't include them at all
        },
        
        // More real data
        skills: realSkills,
        proposals: realProposals,
        verified: isVerified,
        category: cleanedCategory,
        jobType: jobType,
        experienceLevel: experienceLevel,
        workload: workload,
        
        // Additional real fields
        source: 'upwork',
        isRealJob: true,
        apiDataQuality: 'real_job_data',
        
        // Debug info (remove in production)
        _debug: {
          hasClientData: !!node.client,
          clientFields: node.client ? Object.keys(node.client) : [],
          rawClient: node.client
        }
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} jobs with 100% REAL API data`)
    
    return { success: true, jobs: jobs, error: null }
    
  } catch (error: any) {
    console.error('Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

export async function GET() {
  try {
    console.log('=== JOBS API: 100% REAL AVAILABLE DATA ===')
    
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
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success 
        ? `✅ Loaded ${result.jobs.length} real Upwork jobs` 
        : `Error: ${result.error}`,
      upworkConnected: true,
      dataQuality: '100% Real API Data (limited client info)',
      _note: 'Client detailed info (total spent, country, hires) is not available in job search API'
    })
    
  } catch (error: any) {
    console.error('Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message,
      dataQuality: 'Error fetching data'
    }, { status: 500 })
  }
}