// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching COMPLETE job details...')
    
    // ✅ CORRECT QUERY WITH ALL AVAILABLE FIELDS
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch {
            edges {
              node {
                id
                title
                description
                # ✅ 1. CONTENT - might have more details
                content {
                  description
                }
                # ✅ 2. CLIENT COMPANY INFO
                clientCompanyPublic {
                  name
                  location {
                    country
                  }
                }
                # ✅ 3. CLASSIFICATION (skills, category, etc.)
                classification {
                  skills {
                    edges {
                      node {
                        skill {
                          prettyName
                        }
                      }
                    }
                  }
                  category {
                    title
                  }
                  jobType
                }
                # ✅ 4. CONTRACT TERMS (BUDGET)
                contractTerms {
                  budget {
                    amount
                    currencyCode
                  }
                }
                # ✅ 5. PROPOSAL COUNT
                contractorSelection {
                  proposalsCount
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
    
    console.log('📥 Response status:', response.status)
    
    if (!response.ok) {
      const error = await response.text()
      console.error('❌ API error:', error.substring(0, 300))
      return { success: false, error: 'API request failed', jobs: [] }
    }
    
    const data = await response.json()
    console.log('✅ Response received, checking structure...')
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)
    
    // DEBUG: Check what fields we got
    if (edges.length > 0 && edges[0].node) {
      const firstNode = edges[0].node
      console.log('📋 Node structure:', {
        hasContent: !!firstNode.content,
        hasClientCompany: !!firstNode.clientCompanyPublic,
        hasClassification: !!firstNode.classification,
        hasContractTerms: !!firstNode.contractTerms,
        contentKeys: firstNode.content ? Object.keys(firstNode.content) : [],
        clientCompanyKeys: firstNode.clientCompanyPublic ? Object.keys(firstNode.clientCompanyPublic) : []
      })
    }
    
    // Format jobs with REAL DATA
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // Extract REAL data from nested objects
      const content = node.content || {}
      const clientCompany = node.clientCompanyPublic || {}
      const classification = node.classification || {}
      const contractTerms = node.contractTerms || {}
      const contractorSelection = node.contractorSelection || {}
      
      // ✅ REAL BUDGET (if available)
      const budgetAmount = contractTerms.budget?.amount
      const budgetCurrency = contractTerms.budget?.currencyCode || 'USD'
      const budgetText = budgetAmount ? 
        `${budgetCurrency} ${budgetAmount}` : 
        'Budget not specified'
      
      // ✅ REAL CLIENT (if available)
      const clientName = clientCompany.name || 'Client name not specified'
      const clientCountry = clientCompany.location?.country || 'Location not specified'
      
      // ✅ REAL SKILLS (if available)
      const skillsEdges = classification.skills?.edges || []
      const realSkills = skillsEdges.map((edge: any) => 
        edge.node?.skill?.prettyName
      ).filter(Boolean) || ['Skills not listed']
      
      // ✅ REAL CATEGORY (if available)
      const jobCategory = classification.category?.title || 'Category not specified'
      
      // ✅ REAL JOB TYPE (if available)
      const jobType = classification.jobType || 'Type not specified'
      
      // ✅ REAL PROPOSAL COUNT (if available)
      const proposalCount = contractorSelection.proposalsCount || 0
      
      return {
        id: node.id,
        title: node.title || 'Title not available',
        description: content.description || node.description || 'Description not available',
        budget: budgetText, // ✅ REAL BUDGET YA "not specified"
        postedDate: 'Recently', // We need to find where posted date is stored
        client: {
          name: clientName, // ✅ REAL CLIENT NAME YA "not specified"
          rating: 4.5, // Default - we need to find where client rating is stored
          country: clientCountry, // ✅ REAL COUNTRY YA "not specified"
          totalSpent: 0, // Default - to be found
          totalHires: 0  // Default - to be found
        },
        skills: realSkills.slice(0, 5), // ✅ REAL SKILLS YA default (max 5)
        proposals: proposalCount, // ✅ REAL PROPOSAL COUNT YA 0
        verified: true,
        category: jobCategory, // ✅ REAL CATEGORY YA default
        jobType: jobType, // ✅ REAL JOB TYPE (Hourly/Fixed)
        source: 'upwork',
        isRealJob: true,
        // For debugging - we can remove this later
        _debug: {
          hasBudget: !!budgetAmount,
          hasClientName: !!clientName,
          skillsCount: realSkills.length
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
        jobType: jobs[0].jobType
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
        `✅ Found ${result.jobs.length} jobs with detailed info` : 
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