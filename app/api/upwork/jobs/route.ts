// app/api/upwork/jobs/route.ts 
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ Helper function to refresh token
async function refreshUpworkToken(userId: number, refreshToken: string): Promise<any> {
  try {
    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      throw new Error('Upwork configuration missing')
    }

    const tokenUrl = 'https://www.upwork.com/api/v3/oauth2/token'
    
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    })

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Token refresh failed: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Token refresh helper error:', error)
    throw error
  }
}

// ✅ Main function to fetch jobs with automatic token refresh
async function fetchJobsWithTokenRetry(accessToken: string, refreshToken: string, userId: number) {
  let currentToken = accessToken
  let shouldRetry = true
  
  while (shouldRetry) {
    try {
      console.log('🚀 Fetching jobs with token...')
      
      const graphqlQuery = {
        query: `
          query GetMarketplaceJobs {
            marketplaceJobPostingsSearch {
              edges {
                node {
                  id
                  title
                  description
                  amount {
                    rawValue
                    currency
                    displayValue
                  }
                  skills {
                    name
                  }
                  totalApplicants
                  category
                  createdDateTime
                  client {
                    displayName
                    rating
                    totalSpent
                    totalHired
                    paymentVerificationStatus
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
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(graphqlQuery)
      })

      console.log('📥 API Status:', response.status)

      // ✅ If token expired, try to refresh
      if (response.status === 401) {
        console.log('🔁 Token expired, attempting refresh...')
        
        try {
          const newTokenData = await refreshUpworkToken(userId, refreshToken)
          
          // Update database
          await pool.query(
            `UPDATE upwork_accounts SET 
               access_token = $1,
               refresh_token = $2,
               updated_at = NOW()
             WHERE user_id = $3`,
            [newTokenData.access_token, newTokenData.refresh_token || refreshToken, userId]
          )
          
          currentToken = newTokenData.access_token
          console.log('✅ Token refreshed, retrying request...')
          continue // Retry with new token
          
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError)
          throw new Error('TOKEN_REFRESH_FAILED')
        }
      }

      if (!response.ok) {
        throw new Error(`API error ${response.status}`)
      }

      const data = await response.json()
      
      if (data.errors) {
        console.error('GraphQL errors:', data.errors)
        throw new Error(data.errors[0]?.message || 'GraphQL error')
      }

      const edges = data.data?.marketplaceJobPostingsSearch?.edges || []
      console.log(`✅ Found ${edges.length} jobs`)

      // ✅ Format jobs
      const jobs = edges.map((edge: any) => {
        const node = edge.node || {}
        const client = node.client || {}
        
        // Budget
        let budgetText = 'Budget not specified'
        if (node.amount?.displayValue) {
          budgetText = node.amount.displayValue
        }
        
        // Posted time
        const postedDate = node.createdDateTime
        let postedText = 'Recently'
        if (postedDate) {
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
        }
        
        return {
          id: node.id,
          title: node.title || '',
          description: node.description || '',
          budget: budgetText,
          postedText: postedText,
          client: {
            name: client.displayName || 'Client',
            rating: parseFloat(client.rating || 0).toFixed(1),
            totalSpent: client.totalSpent || 0,
            paymentVerified: client.paymentVerificationStatus === 'VERIFIED',
          },
          skills: node.skills?.map((s: any) => s.name).filter(Boolean) || [],
          proposals: node.totalApplicants || 0,
          category: node.category || '',
          isRealJob: true
        }
      })

      return { success: true, jobs: jobs }
      
    } catch (error: any) {
      if (error.message === 'TOKEN_REFRESH_FAILED') {
        return { 
          success: false, 
          error: 'Token refresh failed. Please reconnect Upwork account.',
          requiresReconnect: true 
        }
      }
      
      return { 
        success: false, 
        error: error.message || 'Failed to fetch jobs',
        requiresReconnect: false 
      }
    }
    
    shouldRetry = false
  }
  
  return { success: false, error: 'Unknown error', requiresReconnect: false }
}

export async function GET() {
  try {
    console.log('=== JOBS API WITH TOKEN REFRESH ===')

    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        error: 'Not authenticated' 
      }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Get tokens from database
    const upworkResult = await pool.query(
      `SELECT access_token, refresh_token 
       FROM upwork_accounts WHERE user_id = $1`,
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Connect Upwork account first',
        upworkConnected: false,
        requiresReconnect: true
      })
    }
    
    const { access_token, refresh_token } = upworkResult.rows[0]
    
    if (!access_token) {
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Invalid access token',
        upworkConnected: false,
        requiresReconnect: true
      })
    }
    
    console.log('🔑 Tokens available, fetching jobs...')
    
    const result = await fetchJobsWithTokenRetry(
      access_token, 
      refresh_token, 
      user.id
    )
    
    return NextResponse.json({
      success: result.success,
      jobs: result.jobs || [],
      total: result.jobs?.length || 0,
      message: result.success ? 
        `✅ SUCCESS: ${result.jobs?.length || 0} REAL jobs` : 
        `❌ ${result.error}`,
      upworkConnected: result.success,
      requiresReconnect: result.requiresReconnect || false,
      timestamp: new Date().toISOString()
    })
    
  } catch (error: any) {
    console.error('❌ Main error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: 'Server error: ' + error.message,
      requiresReconnect: true
    }, { status: 500 })
  }
}