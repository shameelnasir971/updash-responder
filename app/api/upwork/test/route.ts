// app/api/upwork/test/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'
import pool from '../../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get access token
    const upworkResult = await pool.query(
      'SELECT access_token, created_at FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )

    if (upworkResult.rows.length === 0 || !upworkResult.rows[0].access_token) {
      return NextResponse.json({ 
        success: false,
        message: 'No Upwork account connected',
        connected: false 
      })
    }

    const accessToken = upworkResult.rows[0].access_token
    console.log('🔑 Testing token:', accessToken.substring(0, 20) + '...')

    // Test 1: Check if token is valid
    const testResponse = await fetch('https://www.upwork.com/api/auth/v1/info.json', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })

    let userInfo = null
    let tokenValid = false
    
    if (testResponse.ok) {
      userInfo = await testResponse.json()
      tokenValid = true
      console.log('✅ Token is VALID')
    } else {
      console.log('❌ Token is INVALID')
    }

    // Test 2: Try to fetch jobs
    let jobsResponse = null
    let jobsCount = 0
    
    if (tokenValid) {
      const jobsUrl = new URL('https://www.upwork.com/api/profiles/v3/search/jobs')
      jobsUrl.search = new URLSearchParams({
        q: 'web development',
        t: '0',
        sort: 'recency',
        paging: '0;10'
      }).toString()

      const jobsRes = await fetch(jobsUrl.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Upwork-API-TenantId': 'api'
        }
      })

      if (jobsRes.ok) {
        jobsResponse = await jobsRes.json()
        jobsCount = jobsResponse.profiles?.length || jobsResponse.jobs?.length || 0
        console.log(`✅ Jobs fetch successful: ${jobsCount} jobs`)
      }
    }

    return NextResponse.json({
      success: true,
      connected: true,
      tokenValid: tokenValid,
      userInfo: userInfo?.info || null,
      jobsCount: jobsCount,
      rawJobsResponse: jobsResponse,
      debug: {
        tokenLength: accessToken.length,
        tokenPreview: accessToken.substring(0, 30) + '...',
        connectionTime: upworkResult.rows[0].created_at
      }
    })

  } catch (error: any) {
    console.error('Test API error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: error.stack
    }, { status: 500 })
  }
}