// app/api/upwork/jobs/route.ts - SIMPLE WORKING VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API CALLED ===')
    
    // ✅ SIMPLE AUTH CHECK
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({
        success: true,
        jobs: [],
        total: 0,
        upworkConnected: false,
        message: 'User not authenticated'
      })
    }
    
    console.log('User:', user.email)
    
    // ✅ CHECK UPWORK CONNECTION
    const upworkResult = await pool.query(
      'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    let jobs = []
    let message = ''
    
    if (upworkResult.rows.length > 0 && upworkResult.rows[0].access_token) {
      // ✅ TRY TO FETCH REAL JOBS
      const accessToken = upworkResult.rows[0].access_token
      console.log('Access token found')
      
      try {
        // Try GraphQL API
        const response = await fetch('https://api.upwork.com/graphql', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query: `{
              jobs {
                search(first: 20) {
                  edges {
                    node {
                      id
                      title
                      description
                      budget {
                        amount
                        currency
                      }
                      client {
                        name
                        feedback
                        country
                      }
                      skills {
                        name
                      }
                      proposals
                      isVerified
                      postedOn
                    }
                  }
                }
              }
            }`
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data.data?.jobs?.search?.edges) {
            jobs = data.data.jobs.search.edges.map((edge: any) => ({
              id: edge.node.id,
              title: edge.node.title || 'Upwork Job',
              description: edge.node.description || '',
              budget: edge.node.budget ? 
                `${edge.node.budget.currency || 'USD'} ${edge.node.budget.amount || '0'}` : 
                'Not specified',
              postedDate: edge.node.postedOn ? 
                new Date(edge.node.postedOn).toLocaleDateString() : 
                'Recently',
              client: {
                name: edge.node.client?.name || 'Client',
                rating: edge.node.client?.feedback || 4.5,
                country: edge.node.client?.country || 'Remote',
                totalSpent: 0,
                totalHires: 0
              },
              skills: edge.node.skills?.map((s: any) => s.name) || [],
              proposals: edge.node.proposals || 0,
              verified: edge.node.isVerified || false,
              category: 'Web Development',
              duration: 'Not specified',
              source: 'upwork',
              isRealJob: true
            }))
            
            message = `Found ${jobs.length} real jobs`
          } else {
            message = 'No jobs found in response'
            jobs = [] // Empty array
          }
        } else {
          message = 'API request failed'
          jobs = [] // Empty array
        }
      } catch (apiError) {
        console.error('API error:', apiError)
        message = 'Failed to fetch jobs'
        jobs = [] // Empty array
      }
    } else {
      message = 'Connect Upwork account to see jobs'
      jobs = [] // Empty array
    }
    
    console.log(`Returning ${jobs.length} jobs`)
    
    return NextResponse.json({
      success: true,
      jobs: jobs, // Real jobs or empty array
      total: jobs.length,
      upworkConnected: upworkResult.rows.length > 0,
      message: message
    })
    
  } catch (error: any) {
    console.error('Jobs API error:', error.message)
    return NextResponse.json({
      success: true,
      jobs: [], // ❌ NO MOCK DATA - Empty array
      total: 0,
      upworkConnected: false,
      message: 'Error loading jobs'
    })
  }
}