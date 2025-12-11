// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching jobs with ALL REAL details...')
    
    // ✅ CORRECT QUERY - ALL AVAILABLE FIELDS FROM DISCOVERY
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch {
            edges {
              node {
                id
                title
                description
                # ✅ REAL BUDGET - amount field
                amount
                # ✅ REAL CLIENT - client field
                client {
                  displayName
                  totalSpent
                  location {
                    country
                  }
                }
                # ✅ REAL SKILLS - skills field  
                skills {
                  edges {
                    node {
                      skill {
                        prettyName
                      }
                    }
                  }
                }
                # ✅ REAL CATEGORY
                category
                subcategory
                # ✅ REAL PROPOSAL COUNT
                totalApplicants
                # ✅ REAL POSTING DATES
                createdDateTime
                publishedDateTime
                # ✅ REAL EXPERIENCE LEVEL
                experienceLevel
                # ✅ REAL JOB TYPE
                engagement
                # ✅ REAL DURATION
                duration
                durationLabel
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
    console.log('✅ Response received')
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)
    
    // Format jobs with REAL DATA
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // ✅ REAL BUDGET (if available)
      const budgetAmount = node.amount
      const budgetText = budgetAmount ? 
        `$${budgetAmount}` : 
        'Budget not specified'
      
      // ✅ REAL CLIENT (if available)
      const client = node.client || {}
      const clientName = client.displayName || 'Client not specified'
      const clientCountry = client.location?.country || 'Location not specified'
      const clientTotalSpent = client.totalSpent || 0
      
      // ✅ REAL SKILLS (if available)
      const skillsEdges = node.skills?.edges || []
      const realSkills = skillsEdges.map((edge: any) => 
        edge.node?.skill?.prettyName
      ).filter(Boolean)
      
      // ✅ REAL POSTED DATE (if available)
      let postedDate = 'Recently'
      if (node.publishedDateTime) {
        postedDate = new Date(node.publishedDateTime).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      }
      
      // ✅ REAL PROPOSAL COUNT (if available)
      const proposalCount = node.totalApplicants || 0
      
      return {
        id: node.id,
        title: node.title || 'Title not available',
        description: node.description || 'Description not available',
        budget: budgetText, // ✅ REAL BUDGET
        postedDate: postedDate, // ✅ REAL POSTED DATE
        client: {
          name: clientName, // ✅ REAL CLIENT NAME
          rating: 4.5, // Default (not available in API)
          country: clientCountry, // ✅ REAL CLIENT COUNTRY
          totalSpent: clientTotalSpent, // ✅ REAL CLIENT TOTAL SPENT
          totalHires: 0 // Not available in API
        },
        skills: realSkills.length > 0 ? realSkills.slice(0, 5) : ['Skills not listed'], // ✅ REAL SKILLS
        proposals: proposalCount, // ✅ REAL PROPOSAL COUNT
        verified: true,
        category: node.category || node.subcategory || 'Category not specified', // ✅ REAL CATEGORY
        jobType: node.engagement || 'Type not specified', // ✅ REAL JOB TYPE
        experienceLevel: node.experienceLevel || 'Not specified', // ✅ REAL EXPERIENCE LEVEL
        duration: node.durationLabel || node.duration || 'Not specified', // ✅ REAL DURATION
        source: 'upwork',
        isRealJob: true,
        // Debug info
        _debug: {
          hasBudget: !!node.amount,
          hasClient: !!client.displayName,
          skillsCount: realSkills.length,
          rawClient: client
        }
      }
    })
    
    console.log(`✅ Formatted ${jobs.length} jobs with REAL details`)
    
    // Log first job's real details for verification
    if (jobs.length > 0) {
      console.log('📋 First job REAL details:', {
        id: jobs[0].id,
        title: jobs[0].title,
        budget: jobs[0].budget,
        clientName: jobs[0].client.name,
        skills: jobs[0].skills,
        category: jobs[0].category,
        proposals: jobs[0].proposals
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
    console.log('=== JOBS API CALLED ===')
    
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
        `✅ Found ${result.jobs.length} jobs with REAL details` : 
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