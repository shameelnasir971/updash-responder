// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchSimpleRealJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching REAL Upwork jobs...')
    
    // ✅ SIMPLE CORRECT GraphQL Query - Your Schema ke hisaab se
    const graphqlQuery = {
      query: `
        query GetJobs {
          marketplaceJobPostingsSearch {
            edges {
              node {
                id
                title
                description
                amount {
                  displayValue
                }
                skills {
                  name
                }
                totalApplicants
                category
                createdDateTime
                experienceLevel
                engagement
                location {
                  country
                }
              }
            }
          }
        }
      `
    }

    console.log('📤 Sending GraphQL query...')
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
      console.error('❌ API error response:', errorText.substring(0, 200))
      return { success: false, error: `API error ${response.status}`, jobs: [] }
    }

    const data = await response.json()
    
    // ✅ DEBUG: See actual response
    console.log('📊 Response structure:', {
      hasData: !!data.data,
      hasErrors: !!data.errors,
      edgesCount: data.data?.marketplaceJobPostingsSearch?.edges?.length || 0
    })
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      return { success: false, error: data.errors[0]?.message || 'GraphQL error', jobs: [] }
    }

    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges from Upwork`)
    
    if (edges.length > 0) {
      console.log('🔍 First job data:', {
        id: edges[0].node.id,
        title: edges[0].node.title,
        budget: edges[0].node.amount?.displayValue,
        skills: edges[0].node.skills?.length,
        engagement: edges[0].node.engagement
      })
    }

    // ✅ Format jobs - Simple and safe
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      
      // 1. BUDGET
      const budgetText = node.amount?.displayValue || 'Budget not specified'
      
      // 2. POSTED TIME - "X minutes ago"
      const postedDate = node.createdDateTime
      let postedText = 'Recently'
      if (postedDate) {
        try {
          const now = new Date()
          const posted = new Date(postedDate)
          const diffMs = now.getTime() - posted.getTime()
          const diffMins = Math.floor(diffMs / 60000)
          
          if (diffMins < 60) {
            postedText = `${diffMins} minutes ago`
          } else if (diffMins < 1440) {
            postedText = `${Math.floor(diffMins / 60)} hours ago`
          } else {
            postedText = `${Math.floor(diffMins / 1440)} days ago`
          }
        } catch (e) {
          console.log('Date error:', e)
        }
      }
      
      // 3. SKILLS
      const realSkills = Array.isArray(node.skills) 
        ? node.skills.map((s: any) => s.name).filter(Boolean)
        : []
      
      // 4. PROPOSALS
      const proposals = node.totalApplicants || 0
      
      // 5. JOB TYPE STRING
      let jobTypeString = budgetText
      if (node.experienceLevel) {
        const exp = node.experienceLevel.toLowerCase()
        jobTypeString += ` - ${exp.charAt(0).toUpperCase() + exp.slice(1)}`
      }
      if (node.engagement) {
        jobTypeString += ` - ${node.engagement}`
      }
      
      // 6. RETURN JOB OBJECT
      return {
        id: node.id || `job_${Date.now()}`,
        title: node.title || 'Upwork Job',
        description: node.description || '',
        budget: budgetText,
        postedText: postedText,
        jobTypeString: jobTypeString,
        
        // Client info (generic since we don't have it)
        client: {
          name: 'Client',
          rating: 0.0,
          country: node.location?.country || 'Remote',
          totalSpent: 0,
          totalHires: 0,
        },
        
        skills: realSkills,
        proposals: proposals,
        verified: false,
        category: node.category || '',
        source: 'upwork',
        isRealJob: true
      }
    })

    console.log(`✅ Formatted ${jobs.length} REAL jobs`)
    return { success: true, jobs: jobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

export async function GET() {
  try {
    console.log('=== SIMPLE JOBS API (FIXED) ===')

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Connect Upwork account first',
        upworkConnected: false
      })
    }
    
    const accessToken = upworkResult.rows[0].access_token
    
    console.log('🔑 Token exists, fetching jobs...')
    const result = await fetchSimpleRealJobs(accessToken)
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs,
      total: result.jobs.length,
      message: result.success ? 
        `✅ SUCCESS: ${result.jobs.length} REAL jobs` : 
        `❌ ${result.error}`,
      upworkConnected: true,
      timestamp: new Date().toISOString()
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