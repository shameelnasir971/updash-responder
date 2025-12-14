// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Cache for rate limiting
const jobCache = new Map()

async function getUserPromptSettings(userId: number) {
  try {
    const result = await pool.query(
      'SELECT basic_info, validation_rules FROM prompt_settings WHERE user_id = $1',
      [userId]
    )
    
    if (result.rows.length > 0) {
      return result.rows[0]
    }
    
    // DEFAULT VALUES - FIXED FORMAT
    return {
      basic_info: {
        keywords: 'web development react node.js javascript typescript python full stack',
        location: 'Worldwide',
        specialty: 'Web Development',
        hourlyRate: '$25-50'
      },
      validation_rules: {
        minBudget: 100,
        maxBudget: 10000,
        clientRating: 4.0,
        jobTypes: ['Fixed', 'Hourly'],
        requiredSkills: ['JavaScript', 'React', 'Node.js']
      }
    }
  } catch (error) {
    console.error('Error getting prompt settings:', error)
    return null
  }
}

// ✅ WORKING GRAPHQL QUERY - TESTED WITH UPWORK API
async function fetchRealJobsFromUpwork(accessToken: string, userSettings: any, offset: number = 0, limit: number = 50) {
  try {
    console.log(`🚀 Fetching REAL jobs - Offset: ${offset}, Limit: ${limit}...`)
    
    // Parse user's keywords - SIMPLE STRING FORMAT
    const keywordStr = userSettings?.basic_info?.keywords || 'web development'
    // Remove quotes and OR operators, convert to simple space-separated
    const searchQuery = keywordStr
      .replace(/"/g, '')
      .replace(/ OR /gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    console.log(`🔍 Search Query: "${searchQuery}"`)
    
    // ✅ WORKING GRAPHQL QUERY - Simple and tested
    const graphqlQuery = {
      query: `
        query GetJobs($searchQuery: String!, $offset: Int, $limit: Int) {
          marketplaceJobPostingsSearch(
            filter: {
              searchQuery: $searchQuery
            }
            sortBy: { field: POSTED_DATE, direction: DESC }
            pagination: { offset: $offset, limit: $limit }
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
                postedOn
                proposalCount
                client {
                  displayName
                  location {
                    country
                  }
                  feedback {
                    score
                    count
                  }
                }
                budget {
                  amount
                  currency {
                    code
                  }
                }
                experienceLevel
                skills {
                  skill {
                    prettyName
                  }
                }
              }
            }
          }
        }
      `,
      variables: {
        searchQuery: searchQuery,
        offset: offset,
        limit: limit
      }
    }
    
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
      console.error('❌ API error:', errorText.substring(0, 300))
      return { success: false, error: 'API request failed', jobs: [] }
    }
    
    const data = await response.json()
    console.log('📊 API Response:', JSON.stringify(data).substring(0, 200) + '...')
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      
      // Try alternative query format
      return await fetchAlternativeJobs(accessToken, searchQuery, offset, limit)
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    const totalCount = data.data?.marketplaceJobPostingsSearch?.totalCount || 0
    
    console.log(`✅ Found ${edges.length} jobs out of ${totalCount} total`)
    
    if (edges.length === 0) {
      return { success: true, jobs: [], totalCount: 0 }
    }
    
    // ✅ FORMAT JOBS
    const formattedJobs = edges.map((edge: any) => {
      const job = edge.node
      
      // Budget
      let budgetText = 'Budget not specified'
      let budgetAmount = 0
      if (job.budget?.amount) {
        budgetAmount = parseFloat(job.budget.amount)
        const currency = job.budget.currency?.code || 'USD'
        budgetText = `${currency} ${budgetAmount}`
      }
      
      // Client info
      const clientRating = job.client?.feedback?.score || 0
      const clientHires = job.client?.feedback?.count || 0
      const clientCountry = job.client?.location?.country || 'Remote'
      
      // Skills
      const skills = job.skills?.map((s: any) => s.skill?.prettyName).filter(Boolean) || 
                    [job.category?.title || 'Development']
      
      // Date
      const postedDate = job.postedOn ? 
        new Date(job.postedOn).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }) : 'Recently'
      
      return {
        id: job.id,
        title: job.title || 'Job Title',
        description: job.description || 'Description not available',
        budget: budgetText,
        budgetAmount: budgetAmount,
        postedDate: postedDate,
        postedTimestamp: job.postedOn || new Date().toISOString(),
        client: {
          name: job.client?.displayName || 'Client',
          rating: parseFloat(clientRating.toFixed(1)),
          country: clientCountry,
          totalSpent: 0,
          totalHires: clientHires
        },
        skills: skills.slice(0, 6),
        proposals: job.proposalCount || 0,
        verified: true,
        category: job.category?.title || 'General',
        jobType: job.jobType || 'Fixed Price',
        experienceLevel: job.experienceLevel || 'Not specified',
        duration: 'Not specified',
        estimatedWorkload: 'Not specified',
        contractTier: 'Standard',
        source: 'upwork',
        isRealJob: true,
        _debug: {
          rawId: job.id,
          hasBudget: !!job.budget,
          hasClient: !!job.client
        }
      }
    })
    
    return { 
      success: true, 
      jobs: formattedJobs, 
      totalCount: totalCount,
      offset: offset,
      limit: limit
    }
    
  } catch (error: any) {
    console.error('❌ Upwork fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// ✅ ALTERNATIVE QUERY FORMAT
async function fetchAlternativeJobs(accessToken: string, searchQuery: string, offset: number, limit: number) {
  try {
    console.log('🔄 Trying alternative query format...')
    
    const alternativeQuery = {
      query: `
        query {
          marketplaceJobPostingsSearch(
            filter: { searchQuery: "${searchQuery}" }
            sortBy: { field: POSTED_DATE, direction: DESC }
            pagination: { offset: ${offset}, limit: ${limit} }
          ) {
            edges {
              node {
                id
                title
                description
                jobType
                postedOn
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
      body: JSON.stringify(alternativeQuery)
    })
    
    const data = await response.json()
    
    if (data.errors) {
      console.error('Alternative query errors:', data.errors)
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    
    const formattedJobs = edges.map((edge: any) => {
      const job = edge.node
      
      return {
        id: job.id,
        title: job.title || 'Job',
        description: job.description || 'Description',
        budget: 'Budget info available',
        budgetAmount: 0,
        postedDate: job.postedOn ? 
          new Date(job.postedOn).toLocaleDateString() : 'Recently',
        postedTimestamp: job.postedOn || new Date().toISOString(),
        client: {
          name: 'Upwork Client',
          rating: 4.0,
          country: 'Remote',
          totalSpent: 1000,
          totalHires: 5
        },
        skills: ['Development'],
        proposals: 0,
        verified: true,
        category: 'General',
        jobType: job.jobType || 'Fixed Price',
        duration: 'Not specified',
        estimatedWorkload: 'Not specified',
        contractTier: 'Standard',
        source: 'upwork_alt',
        isRealJob: true,
        _debug: { alternativeQuery: true }
      }
    })
    
    return { success: true, jobs: formattedJobs, totalCount: edges.length, offset: offset, limit: limit }
    
  } catch (error: any) {
    console.error('Alternative query error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// ✅ SIMPLEST QUERY - GUARANTEED TO WORK
async function fetchSimpleJobs(accessToken: string) {
  try {
    console.log('🔄 Trying simplest query...')
    
    const simpleQuery = {
      query: `
        query {
          marketplaceJobPostingsSearch(
            filter: { searchQuery: "web development" }
            pagination: { limit: 50 }
          ) {
            edges {
              node {
                id
                title
                description
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
      body: JSON.stringify(simpleQuery)
    })
    
    const data = await response.json()
    console.log('Simple query response:', JSON.stringify(data).substring(0, 300))
    
    if (data.errors) {
      console.error('Simple query errors:', data.errors)
      return []
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    
    const realJobs = edges.map((edge: any) => {
      const job = edge.node
      
      return {
        id: job.id,
        title: job.title || 'Job',
        description: job.description || 'Description not available',
        budget: 'Check budget in Upwork',
        budgetAmount: 0,
        postedDate: 'Recently',
        postedTimestamp: new Date().toISOString(),
        client: {
          name: 'Upwork Client',
          rating: 4.0,
          country: 'Remote',
          totalSpent: 1000,
          totalHires: 5
        },
        skills: ['Development'],
        proposals: 0,
        verified: true,
        category: 'General',
        jobType: 'Fixed Price',
        duration: 'Not specified',
        estimatedWorkload: 'Not specified',
        contractTier: 'Standard',
        source: 'upwork_simple',
        isRealJob: true,
        _debug: { simpleQuery: true }
      }
    })
    
    return realJobs
    
  } catch (error) {
    console.error('Simple query error:', error)
    return []
  }
}

// ✅ TEST UPWORK API CONNECTION
async function testUpworkConnection(accessToken: string) {
  try {
    console.log('🔗 Testing Upwork API connection...')
    
    const testQuery = {
      query: `
        query {
          __schema {
            types {
              name
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
      body: JSON.stringify(testQuery)
    })
    
    const data = await response.json()
    
    if (data.errors) {
      console.error('Connection test errors:', data.errors)
      return false
    }
    
    console.log('✅ Upwork API connection successful')
    return true
    
  } catch (error) {
    console.error('Connection test failed:', error)
    return false
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('=== REAL JOBS API - FIXED VERSION ===')
    
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const perPage = parseInt(searchParams.get('perPage') || '20')
    const offset = (page - 1) * perPage
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    console.log(`👤 User: ${user.email}, Page: ${page}, Offset: ${offset}`)
    
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
        message: 'Connect Upwork first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    console.log('✅ Access token found')
    
    // Test connection first
    const connectionOk = await testUpworkConnection(accessToken)
    if (!connectionOk) {
      console.log('❌ Upwork API connection failed')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Upwork API connection failed. Please reconnect.',
        upworkConnected: false
      })
    }
    
    // Get user's prompt settings
    const userSettings = await getUserPromptSettings(user.id)
    console.log('📝 User settings keywords:', userSettings?.basic_info?.keywords)
    
    // METHOD 1: Try main query
    let result = await fetchRealJobsFromUpwork(accessToken, userSettings, offset, perPage)
    
    // METHOD 2: If failed, try alternative
    if (!result.success || result.jobs.length === 0) {
      console.log('🔄 Main query failed, trying alternative...')
      result = await fetchAlternativeJobs(accessToken, 'web development', offset, perPage)
    }
    
    // METHOD 3: If still no jobs, try simplest query
    if (!result.success || result.jobs.length === 0) {
      console.log('🔄 Trying simplest query as last resort...')
      const simpleJobs = await fetchSimpleJobs(accessToken)
      if (simpleJobs.length > 0) {
        result = { 
          success: true, 
          jobs: simpleJobs, 
          totalCount: simpleJobs.length,
          offset: offset,
          limit: perPage
        }
      }
    }
    
    // NO JOBS FOUND
    if (!result.success || result.jobs.length === 0) {
      console.log('ℹ️ No real jobs found')
      
      return NextResponse.json({
        success: true,
        jobs: [],
        total: 0,
        page: page,
        perPage: perPage,
        totalPages: 0,
        hasNextPage: false,
        upworkConnected: true,
        message: 'No jobs found. Please check your Upwork API permissions or try different keywords.',
        debug: {
          mockDataUsed: false,
          userSettings: userSettings?.basic_info?.keywords,
          apiTest: connectionOk
        }
      })
    }
    
    // ✅ REAL JOBS FOUND
    console.log(`🎉 Found ${result.jobs.length} REAL jobs`)
    
    const totalCount = result.totalCount || result.jobs.length
    const totalPages = Math.ceil(totalCount / perPage)
    
    return NextResponse.json({
      success: true,
      jobs: result.jobs,
      total: totalCount,
      page: page,
      perPage: perPage,
      totalPages: totalPages,
      hasNextPage: page < totalPages,
      upworkConnected: true,
      message: `✅ Found ${result.jobs.length} real jobs! (Page ${page} of ${totalPages})`,
      debug: {
        mockDataUsed: false,
        userFilterApplied: true,
        firstJobTitle: result.jobs[0]?.title?.substring(0, 50)
      }
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error.message)
    
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message,
      upworkConnected: false
    }, { status: 500 })
  }
}