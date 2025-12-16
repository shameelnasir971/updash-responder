import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ✅ SUPER SIMPLE - NO COMPLEX LOGIC
export async function GET(request: NextRequest) {
  try {
    console.log('=== JOBS API - SIMPLE VERSION ===')
    
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    console.log('👤 User:', user.email)
    
    // Check Upwork connection
    const upworkResult = await pool.query(
      'SELECT access_token, created_at FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    if (upworkResult.rows.length === 0) {
      console.log('❌ No Upwork account in database')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Upwork account not connected. Please connect first.',
        upworkConnected: false,
        action: 'connect'
      })
    }
    
    const { access_token, created_at } = upworkResult.rows[0]
    
    if (!access_token || access_token.length < 50) {
      console.log('❌ Invalid token in database')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Upwork token is invalid. Please reconnect.',
        upworkConnected: false,
        action: 'reconnect'
      })
    }
    
    // Check if token is old (more than 1 day)
    const tokenAge = Date.now() - new Date(created_at).getTime()
    const oneDay = 24 * 60 * 60 * 1000
    
    if (tokenAge > oneDay) {
      console.log('⚠️ Token is old (more than 1 day)')
      return NextResponse.json({
        success: false,
        jobs: [],
        message: '❌ Upwork token has expired (older than 24 hours). Please reconnect.',
        upworkConnected: false,
        action: 'reconnect',
        tokenAge: Math.round(tokenAge / oneDay) + ' days'
      })
    }
    
    console.log('✅ Token looks valid, testing...')
    
    // Simple test query
    const testQuery = {
      query: `{ user { id } }`
    }
    
    try {
      const response = await fetch('https://api.upwork.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          'X-Upwork-API-TenantId': 'api'
        },
        body: JSON.stringify(testQuery)
      })
      
      console.log('🔐 Token test status:', response.status)
      
      if (response.status === 403 || response.status === 401) {
        console.log('❌ Token test failed with 403/401')
        return NextResponse.json({
          success: false,
          jobs: [],
          message: '❌ Upwork token expired or invalid. Please reconnect.',
          upworkConnected: false,
          action: 'reconnect'
        })
      }
      
      // If token is valid, try to fetch jobs
      console.log('✅ Token valid, fetching jobs...')
      
      const jobsQuery = {
        query: `
          query GetJobs {
            marketplaceJobPostingsSearch(first: 20) {
              edges {
                node {
                  id
                  title
                  description
                  amount { rawValue currency }
                  skills { name }
                  totalApplicants
                  category
                  createdDateTime
                }
              }
            }
          }
        `
      }
      
      const jobsResponse = await fetch('https://api.upwork.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Content-Type': 'application/json',
          'X-Upwork-API-TenantId': 'api'
        },
        body: JSON.stringify(jobsQuery)
      })
      
      if (!jobsResponse.ok) {
        throw new Error(`Jobs fetch failed: ${jobsResponse.status}`)
      }
      
      const jobsData = await jobsResponse.json()
      
      if (jobsData.errors) {
        console.error('GraphQL errors:', jobsData.errors)
        throw new Error(jobsData.errors[0]?.message || 'GraphQL error')
      }
      
      const edges = jobsData.data?.marketplaceJobPostingsSearch?.edges || []
      
      // Format jobs
      const jobs = edges.map((edge: any) => {
        const node = edge.node || {}
        
        return {
          id: node.id || `job_${Date.now()}`,
          title: node.title || 'Job Title',
          description: node.description || 'Job Description',
          budget: node.amount?.rawValue ? `$${parseFloat(node.amount.rawValue).toFixed(2)}` : 'Not specified',
          postedDate: node.createdDateTime ? new Date(node.createdDateTime).toLocaleDateString() : 'Recently',
          client: { name: 'Client', rating: 4.5, country: 'Remote' },
          skills: node.skills?.map((s: any) => s.name).filter(Boolean) || [],
          proposals: node.totalApplicants || 0,
          verified: true,
          category: node.category || 'General',
          source: 'upwork',
          isRealJob: true
        }
      })
      
      console.log(`✅ Successfully fetched ${jobs.length} real jobs`)
      
      return NextResponse.json({
        success: true,
        jobs: jobs,
        total: jobs.length,
        message: `✅ Loaded ${jobs.length} real jobs from Upwork`,
        upworkConnected: true,
        cached: false
      })
      
    } catch (apiError: any) {
      console.error('API call error:', apiError.message)
      return NextResponse.json({
        success: false,
        jobs: [],
        message: `❌ Upwork API error: ${apiError.message}`,
        upworkConnected: false,
        action: 'reconnect'
      })
    }
    
  } catch (error: any) {
    console.error('Fatal error:', error)
    return NextResponse.json({
      success: false,
      jobs: [],
      message: `❌ Server error: ${error.message}`
    }, { status: 500 })
  }
}