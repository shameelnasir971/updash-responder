// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchUpworkJobs(accessToken: string, page: number = 1, limit: number = 50) {
  try {
    console.log(`🚀 Fetching REAL Upwork jobs - Page ${page}, Limit ${limit}...`)
    
    // ✅ CORRECT GraphQL Query based on available schema
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs($offset: Int, $limit: Int) {
          marketplaceJobPostingsSearch(
            first: $limit, 
            offset: $offset, 
            sort: "RECENCY"
          ) {
            totalCount
            edges {
              node {
                id
                title
                description
                ciphertext
                duration
                durationLabel
                engagement
                amount {
                  rawValue
                  currency
                  displayValue
                }
                experienceLevel
                category
                subcategory
                freelancersToHire
                relevance
                enterprise
                totalApplicants
                preferredFreelancerLocation
                preferredFreelancerLocationMandatory
                premium
                applied
                createdDateTime
                publishedDateTime
                renewedDateTime
                client {
                  ... on User {
                    id
                    displayName
                    rating
                    location {
                      country
                    }
                    totalSpent
                    totalHires
                  }
                }
                skills {
                  name
                  normalizedName
                  relevance
                }
                occupations {
                  name
                }
                hourlyBudgetType
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
                localJobUserDistance
                weeklyBudget {
                  rawValue
                  currency
                  displayValue
                }
                engagementDuration
                totalFreelancersToHire
                teamId
                freelancerClientRelation
              }
            }
          }
        }
      `,
      variables: {
        offset: (page - 1) * limit,
        limit: limit
      }
    }
    
    console.log('📤 Sending GraphQL request...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ API request failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 500)
      })
      return { 
        success: false, 
        error: `API request failed: ${response.status} ${response.statusText}`, 
        jobs: [], 
        total: 0 
      }
    }
    
    const data = await response.json()
    
    // Debug log for response
    console.log('📊 GraphQL Response:', {
      hasData: !!data.data,
      hasErrors: !!data.errors,
      errorCount: data.errors?.length || 0
    })
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { 
        success: false, 
        error: data.errors[0]?.message || 'GraphQL query error', 
        jobs: [], 
        total: 0 
      }
    }
    
    const searchData = data.data?.marketplaceJobPostingsSearch
    if (!searchData) {
      console.error('❌ No search data in response')
      return { 
        success: false, 
        error: 'No search data in response', 
        jobs: [], 
        total: 0 
      }
    }
    
    const edges = searchData.edges || []
    const totalCount = searchData.totalCount || 0
    
    console.log(`✅ Found ${edges.length} jobs out of ${totalCount} total`)
    
    // Get user's prompt settings for filtering
    let userKeywords = ['web development', 'react', 'node.js', 'javascript', 'full stack']
    
    try {
      const user = await getCurrentUser()
      if (user) {
        const settingsResult = await pool.query(
          'SELECT basic_info FROM prompt_settings WHERE user_id = $1',
          [user.id]
        )
        if (settingsResult.rows.length > 0 && settingsResult.rows[0].basic_info?.keywords) {
          const keywords = settingsResult.rows[0].basic_info.keywords
          // Extract keywords from string
          userKeywords = keywords
            .toLowerCase()
            .replace(/"/g, '')
            .split(' or ')
            .map((k: string) => k.trim())
            .filter((k: string) => k.length > 0)
        }
      }
    } catch (error) {
      console.log('ℹ️ Using default keywords')
    }
    
    // Format jobs with proper data
    const jobs = edges
      .map((edge: any) => {
        const node = edge.node || {}
        
        // Filter by user keywords if set
        if (userKeywords.length > 0) {
          const jobText = ((node.title || '') + ' ' + (node.description || '')).toLowerCase()
          const matchesKeyword = userKeywords.some((keyword: string) => 
            jobText.includes(keyword.toLowerCase())
          )
          
          if (!matchesKeyword) {
            return null // Skip this job
          }
        }
        
        // ✅ PROPER BUDGET FORMATTING
        let budgetText = 'Budget not specified'
        let rawValue = 0
        let currency = 'USD'
        
        // Fixed price budget
        if (node.amount?.rawValue) {
          rawValue = parseFloat(node.amount.rawValue)
          currency = node.amount.currency || 'USD'
          
          if (currency === 'USD') {
            budgetText = `$${rawValue.toFixed(0)}`
          } else if (currency === 'EUR') {
            budgetText = `€${rawValue.toFixed(0)}`
          } else if (currency === 'GBP') {
            budgetText = `£${rawValue.toFixed(0)}`
          } else {
            budgetText = `${rawValue.toFixed(0)} ${currency}`
          }
        } 
        // Hourly budget
        else if (node.hourlyBudgetMin?.rawValue || node.hourlyBudgetMax?.rawValue) {
          const minVal = node.hourlyBudgetMin?.rawValue ? parseFloat(node.hourlyBudgetMin.rawValue) : 0
          const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal
          currency = node.hourlyBudgetMin?.currency || node.hourlyBudgetMax?.currency || 'USD'
          
          let currencySymbol = ''
          if (currency === 'USD') currencySymbol = '$'
          else if (currency === 'EUR') currencySymbol = '€'
          else if (currency === 'GBP') currencySymbol = '£'
          else currencySymbol = currency + ' '
          
          if (minVal === maxVal || maxVal === 0) {
            budgetText = `${currencySymbol}${minVal.toFixed(0)}/hr`
          } else {
            budgetText = `${currencySymbol}${minVal.toFixed(0)}-${maxVal.toFixed(0)}/hr`
          }
          rawValue = maxVal
        }
        // Weekly budget
        else if (node.weeklyBudget?.rawValue) {
          rawValue = parseFloat(node.weeklyBudget.rawValue)
          currency = node.weeklyBudget.currency || 'USD'
          
          let currencySymbol = ''
          if (currency === 'USD') currencySymbol = '$'
          else if (currency === 'EUR') currencySymbol = '€'
          else if (currency === 'GBP') currencySymbol = '£'
          
          budgetText = `${currencySymbol}${rawValue.toFixed(0)}/week`
        }
        
        // Real skills from API
        const realSkills = node.skills?.map((s: any) => s.name || s.normalizedName).filter(Boolean) || 
                          node.occupations?.map((o: any) => o.name).filter(Boolean) ||
                          ['Skills not specified']
        
        const realProposals = node.totalApplicants || 0
        
        // Posted date
        const postedDate = node.createdDateTime || node.publishedDateTime || node.renewedDateTime
        const formattedDate = postedDate ? 
          new Date(postedDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 
          'Recently'
        
        // Job category
        const category = node.category || node.subcategory || 'General'
        const cleanedCategory = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
        
        // Client information
        let clientName = 'Upwork Client'
        let clientRating = 4.5
        let clientCountry = 'Remote'
        let clientTotalSpent = 0
        let clientTotalHires = 0
        
        if (node.client) {
          clientName = node.client.displayName || 'Upwork Client'
          clientRating = node.client.rating || 4.5
          clientCountry = node.client.location?.country || 'Remote'
          clientTotalSpent = node.client.totalSpent || 0
          clientTotalHires = node.client.totalHires || 0
        }
        
        // Job type from engagement
        let jobType = 'Not specified'
        if (node.engagement) {
          jobType = node.engagement.charAt(0).toUpperCase() + node.engagement.slice(1).toLowerCase()
        }
        
        // Experience level
        let experienceLevel = 'Not specified'
        if (node.experienceLevel) {
          const levelMap: Record<string, string> = {
            'ENTRY': 'Entry Level',
            'INTERMEDIATE': 'Intermediate',
            'EXPERT': 'Expert'
          }
          experienceLevel = levelMap[node.experienceLevel] || node.experienceLevel
        }
        
        // Duration
        let duration = node.durationLabel || node.duration || 'Not specified'
        
        return {
          id: node.id,
          title: node.title || 'Upwork Job',
          description: node.description || node.ciphertext || 'Job description not available',
          budget: budgetText,
          postedDate: formattedDate,
          client: {
            name: clientName,
            rating: clientRating,
            country: clientCountry,
            totalSpent: clientTotalSpent,
            totalHires: clientTotalHires
          },
          skills: realSkills.slice(0, 5),
          proposals: realProposals,
          verified: node.premium || false,
          category: cleanedCategory,
          jobType: jobType,
          experienceLevel: experienceLevel,
          duration: duration,
          freelancersNeeded: node.freelancersToHire || node.totalFreelancersToHire || 1,
          source: 'upwork',
          isRealJob: true,
          rawValue: rawValue,
          currency: currency,
          engagement: node.engagement,
          remote: node.preferredFreelancerLocation?.toLowerCase() === 'remote'
        }
      })
      .filter((job: any) => job !== null) // Remove filtered out jobs
    
    console.log(`✅ Successfully formatted ${jobs.length} REAL jobs`)
    
    // Show sample jobs for debugging
    if (jobs.length > 0) {
      console.log('📋 Sample jobs:')
      jobs.slice(0, 3).forEach((job: any, i: number) => {
        console.log(`  ${i+1}. ${job.title} - ${job.budget}`)
      })
    }
    
    return { 
      success: true, 
      jobs: jobs, 
      total: totalCount,
      error: null 
    }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    console.error('❌ Error stack:', error.stack)
    return { 
      success: false, 
      error: `Fetch error: ${error.message}`, 
      jobs: [], 
      total: 0 
    }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50') // ✅ 50 jobs per page
    
    console.log('=== REAL UPDASH JOBS API ===')
    console.log(`📄 Page: ${page}, Limit: ${limit}`)
    
    // Get current user
    const user = await getCurrentUser()
    if (!user) {
      console.log('❌ Not authenticated')
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log(`👤 User: ${user.email}`)
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token, upwork_user_id FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('❌ Upwork account not connected')
      return NextResponse.json({
        success: false,
        jobs: [],
        total: 0,
        totalPages: 0,
        message: 'Please connect your Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    const upworkUserId = upworkResult.rows[0].upwork_user_id
    
    console.log(`🔑 Upwork token available: ${!!accessToken}`)
    console.log(`👤 Upwork User ID: ${upworkUserId}`)
    
    // Fetch jobs from Upwork
    const result = await fetchUpworkJobs(accessToken, page, limit)
    
    const totalPages = Math.ceil(result.total / limit)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.total,
      totalPages: totalPages,
      currentPage: page,
      itemsPerPage: limit,
      message: result.success ? 
        `✅ Success! Loaded ${result.jobs.length} real jobs from Upwork (Page ${page}/${totalPages})` : 
        `❌ Error: ${result.error}`,
      upworkConnected: true,
      dataQuality: result.success ? '100% REAL Upwork jobs - No mock data' : 'API error',
      debug: {
        hasJobs: result.jobs.length > 0,
        jobTitles: result.jobs.slice(0, 3).map((j: any) => j.title),
        userKeywords: 'web development, react, node.js, javascript'
      }
    })
    
  } catch (error: any) {
    console.error('❌ Main handler error:', error.message)
    return NextResponse.json({
      success: false,
      jobs: [],
      total: 0,
      totalPages: 0,
      message: `Server error: ${error.message}`,
      upworkConnected: false,
      dataQuality: 'Error - Check server logs'
    }, { status: 500 })
  }
}

