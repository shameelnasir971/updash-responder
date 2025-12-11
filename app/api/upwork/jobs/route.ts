// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function fetchUpworkJobs(accessToken: string) {
  try {
    console.log('🚀 Fetching jobs (Money fields without .amount)...')
    
    // ✅ SAFE QUERY - Money fields ko direct use karo (without .amount)
    const graphqlQuery = {
      query: `
        query GetMarketplaceJobs {
          marketplaceJobPostingsSearch {
            edges {
              node {
                id
                title
                description
                # ✅ Money fields directly (no .amount subfield)
                amount
                hourlyBudgetMin
                hourlyBudgetMax
                weeklyBudget
                # ✅ Client info
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
                # ✅ Skills
                skills {
                  name
                  experienceLevel
                }
                # ✅ Other important fields
                totalApplicants
                category
                subcategory
                engagement
                duration
                durationLabel
                createdDateTime
                publishedDateTime
                experienceLevel
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
    
    if (data.errors) {
      console.error('❌ GraphQL errors:', JSON.stringify(data.errors, null, 2))
      
      // Agar Money fields mein error aaye, toh unhein hata do
      if (data.errors[0]?.message?.includes('Money')) {
        console.log('⚠️ Money field error, trying without Money fields...')
        
        // Phir se try karo sirf basic fields se
        return fetchBasicJobs(accessToken)
      }
      
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    console.log(`✅ Found ${edges.length} job edges`)
    
    // Format jobs
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      const client = node.client || {}
      
      // Debug: Check what we actually got
      console.log('Node sample:', {
        id: node.id,
        amount: node.amount,
        hourlyBudgetMin: node.hourlyBudgetMin,
        client: node.client
      })
      
      return {
        id: node.id,
        title: node.title || 'No title',
        description: node.description || 'No description',
        budget: 'To be determined', // Temporary
        postedDate: node.createdDateTime ? 
          new Date(node.createdDateTime).toLocaleDateString() : 
          'Recently',
        client: {
          name: client.name || 'Client name not specified',
          rating: client.feedback?.score || 4.0,
          country: client.location?.country || 'Remote',
          totalSpent: client.totalSpent || 0,
          totalHires: client.totalHired || 0
        },
        skills: node.skills?.map((s: any) => s.name).filter(Boolean) || ['Skills not listed'],
        proposals: node.totalApplicants || 0,
        verified: node.enterprise || true,
        category: node.category || node.subcategory || 'General',
        jobType: node.engagement || node.durationLabel || 'Not specified',
        source: 'upwork',
        isRealJob: true,
        _raw: node // For debugging
      }
    })
    
    return { success: true, jobs: jobs, error: null }
    
  } catch (error: any) {
    console.error('❌ Fetch error:', error.message)
    return { success: false, error: error.message, jobs: [] }
  }
}

// Alternative function if Money fields fail
async function fetchBasicJobs(accessToken: string) {
  try {
    console.log('🔄 Trying BASIC query without Money fields...')
    
    const basicQuery = {
      query: `
        query GetBasicJobs {
          marketplaceJobPostingsSearch {
            edges {
              node {
                id
                title
                description
                client {
                  name
                }
                totalApplicants
                category
                createdDateTime
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
      body: JSON.stringify(basicQuery)
    })
    
    const data = await response.json()
    
    if (data.errors) {
      return { success: false, error: data.errors[0]?.message, jobs: [] }
    }
    
    const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
    
    const jobs = edges.map((edge: any) => {
      const node = edge.node || {}
      return {
        id: node.id,
        title: node.title || 'No title',
        description: node.description || 'No description',
        budget: 'Budget info available after Money type discovery',
        postedDate: node.createdDateTime ? 
          new Date(node.createdDateTime).toLocaleDateString() : 
          'Recently',
        client: {
          name: node.client?.name || 'Client',
          rating: 4.0,
          country: 'Remote',
          totalSpent: 0,
          totalHires: 0
        },
        skills: ['Skills info coming soon'],
        proposals: node.totalApplicants || 0,
        verified: true,
        category: node.category || 'General',
        source: 'upwork',
        isRealJob: true
      }
    })
    
    return { success: true, jobs: jobs, error: null }
  } catch (error: any) {
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
        `✅ Found ${result.jobs.length} jobs (Money type discovery in progress)` : 
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