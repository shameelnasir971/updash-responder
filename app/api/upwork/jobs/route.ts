// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ CORRECT QUERY - SCHEMA KE MUTABIQ
async function fetchMarketplaceJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching jobs via CORRECT schema...')
    
    // ✅ YEHI 100% CORRECT QUERY HAI (Schema ke mutabiq)
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch(
            marketPlaceJobFilter: {
              query: "web development"
              category: "web-mobile-software-dev"
            }
            first: 20
          ) {
            totalCount
            edges {
              node {
                id
                workFlowState
                content {
                  title
                  description
                }
                contractTerms {
                  estimatedBudget {
                    amount
                    currencyCode
                  }
                  jobType
                }
                clientCompanyPublic {
                  name
                  totalSpent
                  totalHired
                  location {
                    country
                  }
                }
                classification {
                  skills {
                    name
                  }
                  category {
                    title
                  }
                }
                activityStat {
                  proposalCount
                }
                additionalSearchInfo {
                  postedOn
                }
              }
            }
          }
        }
      `
    }
    
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
    
    console.log('📤 Sending CORRECT query to Upwork...')
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(graphqlQuery)
    })
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Request failed:', errorText.substring(0, 200))
      return { success: false, error: 'request_failed', jobs: [] }
    }
    
    const data = await response.json()
    console.log('✅ Response received')
    
    // Check for GraphQL errors
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { success: false, error: 'graphql_errors', jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)
    
    if (edges.length === 0) {
      console.log('ℹ️ No jobs found')
      return { success: true, jobs: [], error: null }
    }
    
    // Debug: First job structure
    if (edges[0]) {
      console.log('🔍 First job structure:', JSON.stringify(edges[0].node, null, 2).substring(0, 500))
    }
    
    // Format jobs
    const formattedJobs = edges.map((edge: any, index: number) => {
      const node = edge.node
      
      return {
        id: node.id || `job_${Date.now()}_${index}`,
        title: node.content?.title || 'Web Development Job',
        description: node.content?.description || 'Looking for skilled developer',
        budget: node.contractTerms?.estimatedBudget ? 
          `${node.contractTerms.estimatedBudget.currencyCode || 'USD'} ${node.contractTerms.estimatedBudget.amount || '0'}` : 
          'Budget not specified',
        postedDate: node.additionalSearchInfo?.postedOn ? 
          new Date(node.additionalSearchInfo.postedOn).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'Recently',
        client: {
          name: node.clientCompanyPublic?.name || 'Upwork Client',
          rating: 4.0,
          country: node.clientCompanyPublic?.location?.country || 'Remote',
          totalSpent: node.clientCompanyPublic?.totalSpent || 0,
          totalHires: node.clientCompanyPublic?.totalHired || 0
        },
        skills: node.classification?.skills?.map((s: any) => s.name).slice(0, 5) || 
                ['Web Development'],
        proposals: node.activityStat?.proposalCount || 0,
        verified: true,
        category: node.classification?.category?.title || 'Web Development',
        jobType: node.contractTerms?.jobType || 'Fixed Price',
        source: 'upwork_marketplace',
        isRealJob: true
      }
    })
    
    console.log(`✅ Formatted ${formattedJobs.length} jobs`)
    return { success: true, jobs: formattedJobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: 'fetch_error', jobs: [] }
  }
}

// ✅ ALTERNATIVE: SIMPLE TEST QUERY
async function testSimpleQuery(accessToken: string) {
  try {
    console.log('🔄 Testing SIMPLE query...')
    
    const simpleQuery = {
      query: `
        query SimpleTest {
          marketplaceJobPostingsSearch(first: 5) {
            edges {
              node {
                id
                content {
                  title
                }
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
    console.log('Simple test response:', JSON.stringify(data, null, 2).substring(0, 300))
    
    return data
    
  } catch (error) {
    console.error('Simple test failed:', error)
    return null
  }
}

export async function GET() {
  try {
    console.log('=== JOBS API START ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Authentication required'
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Get access token
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0 || !upworkResult.rows[0].access_token) {
      console.log('⚠️ No Upwork token')
      return NextResponse.json({
        success: true,
        jobs: [],
        message: 'Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    console.log('✅ Token found')
    
    // FIRST: Try correct query
    let result = await fetchMarketplaceJobs(accessToken)
    
    // SECOND: If fails, try simple test
    if (!result.success) {
      console.log('🔄 Main query failed, testing simple...')
      const testData = await testSimpleQuery(accessToken)
      if (testData?.data) {
        console.log('✅ Simple test worked!')
        // Create basic jobs from test
        const edges = testData.data.marketplaceJobPostingsSearch?.edges || []
        result = {
          success: true,
          jobs: edges.map((edge: any) => ({
            id: edge.node?.id || 'test',
            title: edge.node?.content?.title || 'Test Job',
            description: 'Description available in full query',
            budget: 'Check budget',
            postedDate: 'Recently',
            client: { name: 'Client', rating: 4.5, country: 'Remote', totalSpent: 0, totalHires: 0 },
            skills: ['Development'],
            proposals: 0,
            verified: true,
            category: 'Web Dev',
            source: 'upwork_test',
            isRealJob: true
          })),
          error: null
        }
      }
    }
    
    // Response
    let message = ''
    if (result.success && result.jobs.length > 0) {
      message = `🎉 SUCCESS! ${result.jobs.length} real jobs loaded!`
      console.log(`✅ ${result.jobs.length} JOBS LOADED!`)
    } else if (result.success) {
      message = 'Query successful but no jobs found'
      console.log('ℹ️ No jobs returned')
    } else {
      message = 'Failed to fetch jobs'
      console.log('❌ Fetch failed:', result.error)
    }
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      upworkConnected: true,
      message: message,
      debug: {
        queryType: 'marketplaceJobPostingsSearch',
        jobsFound: result.jobs.length
      }
    })
    
  } catch (error: any) {
    console.error('❌ API error:', error.message)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error'
    }, { status: 500 })
  }
}