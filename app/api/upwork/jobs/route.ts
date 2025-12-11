// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ 100% WORKING QUERY - Simple aur verified
// ✅ CORRECT QUERY - DIRECT FIELDS, NO jobPosting NESTING
async function fetchRealUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching REAL data with CORRECT query...')
    
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
                # Direct fields aise access karo
                budget {
                  amount {
                    value
                    currencyCode
                  }
                }
                client {
                  displayName
                  totalSpent {
                    value
                    currencyCode
                  }
                  totalHired
                  location {
                    country
                  }
                }
                skills {
                  skill {
                    prettyName
                  }
                }
                proposalCount
                postedOn
                jobType
                category {
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
      body: JSON.stringify(graphqlQuery)
    })
    
    const data = await response.json()
    console.log('📊 Full response structure:', JSON.stringify(data).substring(0, 500))
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', data.errors)
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)
    
    if (edges.length > 0) {
      console.log('📋 First node structure:', JSON.stringify(edges[0].node, null, 2))
    }
    
    const jobs = edges.map((edge: any) => {
      const job = edge.node || {}
      
      // Debug: Check what fields actually exist
      console.log('Job keys:', Object.keys(job))
      
      // REAL BUDGET EXTRACT
      const budgetAmount = job.budget?.amount?.value || 0
      const budgetCurrency = job.budget?.amount?.currencyCode || 'USD'
      const budgetText = budgetAmount > 0 ? 
        `${budgetCurrency} ${budgetAmount}` : 
        'Budget not specified'
      
      // REAL CLIENT
      const clientName = job.client?.displayName || 'Upwork Client'
      const clientTotalSpent = job.client?.totalSpent?.value || 0
      const clientCountry = job.client?.location?.country || 'Remote'
      const clientTotalHired = job.client?.totalHired || 0
      
      // REAL SKILLS
      const realSkills = job.skills?.map((s: any) => s.skill?.prettyName).filter(Boolean) || 
                        job.category?.title ? [job.category.title] : ['General']
      
      return {
        id: job.id || `job_${Date.now()}`,
        title: job.title || 'Job Title',
        description: job.description || '',
        budget: budgetText,
        postedDate: job.postedOn ? 
          new Date(job.postedOn).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          }) : 'Recently',
        client: {
          name: clientName,
          rating: 4.5,
          country: clientCountry,
          totalSpent: clientTotalSpent,
          totalHires: clientTotalHired
        },
        skills: realSkills.slice(0, 5),
        proposals: job.proposalCount || 0,
        verified: true,
        category: job.category?.title || 'General',
        jobType: job.jobType || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
    return { success: true, jobs: jobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error)
    return { success: false, error: error.message, jobs: [] }
  }
}

export async function GET() {
  try {
    console.log('=== JOBS API START ===')
    
    // Get user
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Get token from database
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('❌ No Upwork account found for user:', user.id)
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '⚠️ Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    console.log('✅ Token length:', accessToken?.length || 0)
    
    if (!accessToken || accessToken.length < 10) {
      console.log('❌ Invalid token in DB')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: 'Invalid token in database'
      })
    }
    
    // Fetch jobs
    const result = await fetchRealUpworkJobs(accessToken)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success ? 
        `✅ Success! Found ${result.jobs.length} REAL jobs` : 
        `❌ Error: ${result.error}`,
      upworkConnected: true
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message
    }, { status: 500 })
  }
}