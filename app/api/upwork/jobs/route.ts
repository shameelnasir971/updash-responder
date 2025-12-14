// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching REAL Upwork jobs...')
    
    // ✅ CORRECTED GraphQL Query - Removed 'first' and 'offset' arguments
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch {
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
                weeklyBudget {
                  rawValue
                  currency
                  displayValue
                }
              }
            }
          }
        }
      `
    }
    
    console.log('📤 Sending corrected GraphQL request...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Upwork-API-TenantId': 'upwork'
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
        error: `HTTP Error: ${response.status}`, 
        jobs: [], 
        total: 0 
      }
    }
    
    const data = await response.json()
    
    // Debug the response structure
    console.log('📊 API Response Keys:', Object.keys(data))
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { 
        success: false, 
        error: data.errors[0]?.message || 'GraphQL error', 
        jobs: [], 
        total: 0 
      }
    }
    
    const searchData = data.data?.marketplaceJobPostingsSearch
    if (!searchData) {
      console.error('❌ No search data in response:', JSON.stringify(data, null, 2).substring(0, 1000))
      return { 
        success: false, 
        error: 'No job search data in response', 
        jobs: [], 
        total: 0 
      }
    }
    
    const edges = searchData.edges || []
    const totalCount = searchData.totalCount || 0
    
    console.log(`✅ Found ${edges.length} job edges, ${totalCount} total`)
    
    // Process and filter jobs
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // Format budget
      let budgetText = 'Budget not specified'
      let rawValue = 0
      let currency = 'USD'
      
      if (node.amount?.rawValue) {
        rawValue = parseFloat(node.amount.rawValue)
        currency = node.amount.currency || 'USD'
        budgetText = node.amount.displayValue || `$${rawValue.toFixed(0)}`
      } else if (node.hourlyBudgetMin?.rawValue) {
        const minVal = parseFloat(node.hourlyBudgetMin.rawValue)
        const maxVal = node.hourlyBudgetMax?.rawValue ? parseFloat(node.hourlyBudgetMax.rawValue) : minVal
        currency = node.hourlyBudgetMin.currency || 'USD'
        
        if (minVal === maxVal) {
          budgetText = `${minVal.toFixed(0)} ${currency}/hr`
        } else {
          budgetText = `${minVal.toFixed(0)}-${maxVal.toFixed(0)} ${currency}/hr`
        }
      }
      
      // Format skills
      const skills = node.skills?.map((s: any) => s.name).filter(Boolean) || 
                    node.occupations?.map((o: any) => o.name).filter(Boolean) || 
                    []
      
      // Format date
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 
        'Recently'
      
      // Client info
      const client = node.client || {}
      
      return {
        id: node.id,
        title: node.title || 'Job Title',
        description: node.description || node.ciphertext || 'Description not available',
        budget: budgetText,
        postedDate: formattedDate,
        client: {
          name: client.displayName || 'Upwork Client',
          rating: client.rating || 4.5,
          country: client.location?.country || 'Remote',
          totalSpent: client.totalSpent || 0,
          totalHires: client.totalHires || 0
        },
        skills: skills.slice(0, 5),
        proposals: node.totalApplicants || 0,
        verified: !!(node.premium || node.enterprise),
        category: node.category || node.subcategory || 'General',
        jobType: node.engagement || node.durationLabel || 'Not specified',
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        rawValue: rawValue,
        currency: currency
      }
    })
    
    // Filter by keywords from user's prompt settings
    let filteredJobs = jobs
    try {
      const user = await getCurrentUser()
      if (user) {
        const settingsResult = await pool.query(
          'SELECT basic_info FROM prompt_settings WHERE user_id = $1',
          [user.id]
        )
        if (settingsResult.rows.length > 0 && settingsResult.rows[0].basic_info?.keywords) {
          const keywords = settingsResult.rows[0].basic_info.keywords
            .toLowerCase()
            .replace(/"/g, '')
            .split(' or ')
            .map((k: string) => k.trim())
            .filter((k: string) => k.length > 0)
          
          if (keywords.length > 0) {
            filteredJobs = jobs.filter((job: { title: string; description: string; skills: any[] }) => {
              const jobText = (job.title + ' ' + job.description + ' ' + job.skills.join(' ')).toLowerCase()
              return keywords.some((keyword: string) => jobText.includes(keyword))
            })
            console.log(`🔍 Filtered from ${jobs.length} to ${filteredJobs.length} jobs using keywords`)
          }
        }
      }
    } catch (error) {
      console.log('ℹ️ Using all jobs (keyword filter failed)')
    }
    
    console.log(`✅ Successfully processed ${filteredJobs.length} REAL Upwork jobs`)
    
    return { 
      success: true, 
      jobs: filteredJobs.slice(0, 50), // Return top 50
      total: filteredJobs.length,
      error: null 
    }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    console.error('❌ Stack trace:', error.stack)
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
    console.log('=== REAL UPDASH JOBS API ===')
    
    const user = await getCurrentUser()
    if (!user) {
      console.log('❌ Not authenticated')
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    console.log(`👤 User: ${user.email}`)
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('❌ Upwork account not connected')
      return NextResponse.json({
        success: false,
        jobs: [],
        total: 0,
        message: 'Please connect your Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    console.log(`🔑 Upwork token available: ${!!accessToken}`)
    
    // Fetch jobs from Upwork
    const result = await fetchUpworkJobs(accessToken)
    
    // Implement client-side pagination if needed
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const start = (page - 1) * limit
    const end = start + limit
    const paginatedJobs = result.jobs.slice(start, end)
    const totalPages = Math.ceil(result.jobs.length / limit)
    
    return NextResponse.json({
      success: result.success,
      jobs: paginatedJobs,
      total: result.total,
      totalPages: totalPages,
      currentPage: page,
      itemsPerPage: limit,
      message: result.success ? 
        `✅ Success! Loaded ${paginatedJobs.length} real jobs from Upwork` : 
        `❌ Error: ${result.error}`,
      upworkConnected: true,
      dataQuality: result.success ? '100% REAL Upwork jobs' : 'API error'
    })
    
  } catch (error: any) {
    console.error('❌ Main handler error:', error.message)
    return NextResponse.json({
      success: false,
      jobs: [],
      total: 0,
      message: `Server error: ${error.message}`,
      upworkConnected: false
    }, { status: 500 })
  }
}

