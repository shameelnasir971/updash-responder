// app/api/upwork/route.ts


import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Simple API Key based authentication (Direct API calls)
async function makeUpworkApiCall(apiKey: string, endpoint: string) {
  try {
    const response = await fetch(`https://www.upwork.com/api/v3/${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Upwork API call failed:', error)
    throw error
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Check if we have API Key (simple method)
    const apiKey = process.env.UPWORK_API_KEY
    const apiSecret = process.env.UPWORK_API_SECRET

    // Method 1: If we have API Key, try direct API call
    if (apiKey && apiSecret) {
      try {
        console.log('🔑 Attempting direct API call with API Key...')
        
        // Test API call - jobs search endpoint
        const jobsData = await makeUpworkApiCall(apiKey, 'profiles/v2/jobs/search.json')
        
        return NextResponse.json({ 
          success: true,
          message: 'Upwork API connected successfully',
          data: jobsData,
          method: 'api_key'
        })
      } catch (apiError) {
        console.log('API Key method failed, trying OAuth...')
      }
    }

    // Method 2: OAuth Flow (if API Key doesn't work)
    const clientId = process.env.UPWORK_CLIENT_ID
    const clientSecret = process.env.UPWORK_CLIENT_SECRET
    const redirectUri = process.env.UPWORK_REDIRECT_URI
    
    if (!clientId || !clientSecret || !redirectUri) {
      console.error('Upwork API configuration missing:')
      console.error('API Key:', apiKey ? 'Present' : 'Missing')
      console.error('Client ID:', clientId ? 'Present' : 'Missing')
      
      return NextResponse.json({ 
        error: 'Upwork API not configured properly.',
        details: {
          api_key: apiKey ? 'Present' : 'Missing',
          client_id: clientId ? 'Present' : 'Missing',
          client_secret: clientSecret ? 'Present' : 'Missing'
        }
      }, { status: 500 })
    }

    // Generate OAuth URL
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    // authUrl.searchParams.set('scope', 'r_jobs')      
    const state = Buffer.from(Date.now().toString()).toString('base64')
    authUrl.searchParams.set('state', state)

    console.log('🔗 Upwork OAuth URL generated for user:', user.id)
    
    return NextResponse.json({ 
      url: authUrl.toString(),
      message: 'Upwork OAuth URL generated successfully',
      method: 'oauth'
    })
  } catch (error) {
    console.error('Upwork API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// Add this POST method to your existing file
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // Handle disconnect action
    if (action === 'disconnect') {
      await pool.query(
        'DELETE FROM upwork_accounts WHERE user_id = $1',
        [user.id]
      )
      
      return NextResponse.json({ 
        success: true,
        message: 'Upwork account disconnected successfully' 
      })
    }

    return NextResponse.json({ 
      error: 'Invalid action' 
    }, { status: 400 })
  } catch (error) {
    console.error('Upwork POST error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}