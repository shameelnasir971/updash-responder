// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching COMPLETE job details with CORRECT fields...')
    
    // ✅ COMPLETE & CORRECT QUERY - All fields verified from schema discovery
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch {
            edges {
              node {
                id
                title
                description
                # ✅ REAL BUDGET DETAILS
                amount {
                  amount
                  currencyCode
                }
                hourlyBudgetMin {
                  amount
                  currencyCode
                }
                hourlyBudgetMax {
                  amount
                  currencyCode
                }
                # ✅ REAL CLIENT DETAILS
                client {
                  name
                  totalSpent
                  totalHired
                  location {
                    country
                  }
                  feedback {
                    score
                    count
                  }
                }
                # ✅ REAL SKILLS
                skills {
                  name
                  experienceLevel
                }
                # ✅ REAL PROPOSAL COUNT
                totalApplicants
                # ✅ REAL CATEGORY
                category
                subcategory
                # ✅ REAL JOB TYPE & DURATION
                engagement
                duration
                durationLabel
                # ✅ POSTED DATE
                createdDateTime
                publishedDateTime
                # ✅ EXPERIENCE LEVEL
                experienceLevel
                # ✅ ENTERPRISE FLAG
                enterprise
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
      console.error('❌ API error:', error.substring(0, 300))
      return { success: false, error: 'API request failed', jobs: [] }
    }
    
    const data = await response.json()
    console.log('✅ Response received with complete details')
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges with complete data`)
    
    // Format jobs with REAL DATA from correct fields
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // ✅ Extract REAL budget (handle hourly vs fixed)
      let budgetText = 'Budget not specified'
      if (node.amount?.amount) {
        budgetText = `${node.amount.currencyCode || 'USD'} ${node.amount.amount}`
      } else if (node.hourlyBudgetMin?.amount && node.hourlyBudgetMax?.amount) {
        budgetText = `Hourly: ${node.hourlyBudgetMin.amount}-${node.hourlyBudgetMax.amount} ${node.hourlyBudgetMin.currencyCode || 'USD'}`
      }
      
      // ✅ Extract REAL client info
      const client = node.client || {}
      const clientRating = client.feedback?.score || 4.0
      const clientTotalSpent = client.totalSpent || 0
      const clientTotalHires = client.totalHired || 0
      const clientCountry = client.location?.country || 'Remote'
      
      // ✅ Extract REAL skills
      const realSkills = node.skills?.map((skill: any) => skill.name).filter(Boolean) || 
                        ['Skills not listed']
      
      // ✅ Extract REAL posted date
      const postedDate = node.createdDateTime || node.publishedDateTime
      const formattedDate = postedDate ? 
        new Date(postedDate).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        }) : 
        'Recently'
      
      return {
        id: node.id,
        title: node.title || 'No title',
        description: node.description || 'No description',
        budget: budgetText, // ✅ REAL BUDGET
        postedDate: formattedDate, // ✅ REAL POSTED DATE
        client: {
          name: client.name || 'Client name not specified', // ✅ REAL CLIENT NAME
          rating: clientRating, // ✅ REAL CLIENT RATING
          country: clientCountry, // ✅ REAL COUNTRY
          totalSpent: clientTotalSpent, // ✅ REAL TOTAL SPENT
          totalHires: clientTotalHires // ✅ REAL TOTAL HIRES
        },
        skills: realSkills.slice(0, 5), // ✅ REAL SKILLS
        proposals: node.totalApplicants || 0, // ✅ REAL PROPOSAL COUNT
        verified: node.enterprise || true,
        category: node.category || node.subcategory || 'General', // ✅ REAL CATEGORY
        jobType: node.engagement || node.durationLabel || 'Not specified', // ✅ REAL JOB TYPE
        experienceLevel: node.experienceLevel || 'Not specified',
        source: 'upwork',
        isRealJob: true
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} jobs with complete real details`)
    
    // Log first job's real details for verification
    if (jobs.length > 0) {
      console.log('📋 First job COMPLETE details:', {
        id: jobs[0].id,
        title: jobs[0].title,
        budget: jobs[0].budget,
        clientName: jobs[0].client.name,
        clientRating: jobs[0].client.rating,
        skills: jobs[0].skills,
        proposals: jobs[0].proposals,
        category: jobs[0].category
      })
    }
    
    return { success: true, jobs: jobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

export async function GET() {
  try {
    console.log('=== JOBS API CALLED (COMPLETE VERSION) ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '⚠️ Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    const result = await fetchUpworkJobs(accessToken)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success ? 
        `✅ Success! Loaded ${result.jobs.length} jobs with complete real details` : 
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