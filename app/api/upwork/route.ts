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

// ✅ NEW FUNCTION: Check Upwork connection status
async function checkUpworkConnection(userId: number) {
  try {
    const result = await pool.query(
      'SELECT id, access_token FROM upwork_accounts WHERE user_id = $1',
      [userId]
    )
    return {
      connected: result.rows.length > 0,
      account: result.rows[0] || null
    }
  } catch (error) {
    console.error('Check connection error:', error)
    return { connected: false, account: null }
  }
}

// ✅ UPDATED POST METHOD with better disconnect handling
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated' 
      }, { status: 401 })
    }

    const body = await request.json()
    const { action, code } = body

    console.log('Upwork POST action:', action, 'for user:', user.id)

    // Handle OAuth callback code
    if (code) {
      const clientId = process.env.UPWORK_CLIENT_ID
      const clientSecret = process.env.UPWORK_CLIENT_SECRET
      const redirectUri = process.env.UPWORK_REDIRECT_URI

      if (!clientId || !clientSecret || !redirectUri) {
        return NextResponse.json({ 
          success: false,
          error: 'OAuth not configured' 
        }, { status: 500 })
      }

      console.log('🔄 Exchanging code for token...')

      // Exchange code for access token
      const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code: code,
          redirect_uri: redirectUri,
        }),
      })

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('❌ Token exchange failed:', errorText)
        throw new Error('Token exchange failed: ' + errorText)
      }

      const tokenData = await tokenResponse.json()
      console.log('✅ Token received successfully')
      
      // Save tokens to database
      await pool.query(
        `INSERT INTO upwork_accounts (user_id, access_token, refresh_token, expires_at, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           access_token = $2, 
           refresh_token = $3, 
           expires_at = $4, 
           updated_at = NOW()`,
        [user.id, tokenData.access_token, tokenData.refresh_token, 
         new Date(Date.now() + tokenData.expires_in * 1000)]
      )

      return NextResponse.json({ 
        success: true,
        message: 'Upwork account connected successfully',
        connected: true
      })
    }

    // ✅ Handle disconnect action (UPDATED)
    if (action === 'disconnect') {
      console.log('Disconnecting Upwork for user:', user.id)
      
      try {
        // First check if connected
        const connection = await checkUpworkConnection(user.id)
        
        if (!connection.connected) {
          return NextResponse.json({ 
            success: false,
            error: 'No Upwork account connected',
            connected: false
          })
        }

        // Delete from database
        await pool.query(
          'DELETE FROM upwork_accounts WHERE user_id = $1',
          [user.id]
        )
        
        console.log('✅ Upwork disconnected successfully for user:', user.id)
        
        return NextResponse.json({ 
          success: true,
          message: 'Upwork account disconnected successfully',
          connected: false
        })
      } catch (error: any) {
        console.error('Disconnect error:', error)
        return NextResponse.json({ 
          success: false,
          error: 'Failed to disconnect: ' + error.message,
          connected: false
        }, { status: 500 })
      }
    }

    // ✅ Handle connection status check
    if (action === 'check') {
      const connection = await checkUpworkConnection(user.id)
      return NextResponse.json({ 
        success: true,
        connected: connection.connected,
        message: connection.connected ? 'Upwork connected' : 'Not connected'
      })
    }

    // ✅ Handle get auth URL
    if (action === 'get-auth-url') {
      const clientId = process.env.UPWORK_CLIENT_ID
      const redirectUri = process.env.UPWORK_REDIRECT_URI
      
      if (!clientId || !redirectUri) {
        return NextResponse.json({ 
          success: false,
          error: 'Configuration missing'
        })
      }
      
      const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`
      
      return NextResponse.json({
        success: true,
        url: authUrl,
        message: 'URL generated'
      })
    }

    return NextResponse.json({ 
      success: false,
      error: 'Invalid action' 
    }, { status: 400 })
  } catch (error: any) {
    console.error('Upwork POST error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error: ' + error.message 
    }, { status: 500 })
  }
}

// ✅ NEW: PATCH method for updating connection
export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        success: false,
        error: 'Not authenticated' 
      }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    if (action === 'refresh-token') {
      // Check if we have refresh token
      const result = await pool.query(
        'SELECT refresh_token FROM upwork_accounts WHERE user_id = $1',
        [user.id]
      )

      if (result.rows.length === 0) {
        return NextResponse.json({ 
          success: false,
          error: 'No refresh token available'
        })
      }

      const refreshToken = result.rows[0].refresh_token
      const clientId = process.env.UPWORK_CLIENT_ID
      const clientSecret = process.env.UPWORK_CLIENT_SECRET

      if (!clientId || !clientSecret) {
        return NextResponse.json({ 
          success: false,
          error: 'OAuth not configured' 
        }, { status: 500 })
      }

      // Refresh the token
      const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      })

      if (!tokenResponse.ok) {
        throw new Error('Token refresh failed')
      }

      const tokenData = await tokenResponse.json()
      
      // Update tokens in database
      await pool.query(
        `UPDATE upwork_accounts 
         SET access_token = $1, 
             refresh_token = $2, 
             expires_at = $3,
             updated_at = NOW()
         WHERE user_id = $4`,
        [tokenData.access_token, tokenData.refresh_token, 
         new Date(Date.now() + tokenData.expires_in * 1000), user.id]
      )

      return NextResponse.json({ 
        success: true,
        message: 'Token refreshed successfully'
      })
    }

    return NextResponse.json({ 
      success: false,
      error: 'Invalid action' 
    }, { status: 400 })
  } catch (error: any) {
    console.error('Upwork PATCH error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 })
  }
}