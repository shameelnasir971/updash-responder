// app/api/upwork/route.ts


import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// 🔧 Get Tenant ID from JWT token
function getTenantIdFromToken(accessToken: string): string | null {
  try {
    // Extract payload from JWT token (format: header.payload.signature)
    const parts = accessToken.split('.')
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString())
      console.log('🔍 JWT payload:', {
        sub: payload.sub,
        user_id: payload.user_id,
        client_id: payload.client_id,
        tenant_id: payload.tenant_id
      })
      
      // Try different possible fields for tenant ID
      return payload.tenant_id || payload.sub || payload.user_id || payload.client_id || null
    }
  } catch (error) {
    console.error('❌ Failed to parse JWT:', error)
  }
  return null
}

// 🔍 Test Upwork API connection
async function testUpworkConnection(accessToken: string): Promise<boolean> {
  try {
    console.log('🧪 Testing Upwork API connection...')
    
    // Try GraphQL endpoint first
    const graphqlQuery = {
      query: `{ user { id nid } }`
    }
    
    const response = await fetch('https://api.upwork.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(graphqlQuery)
    })
    
    if (response.ok) {
      console.log('✅ GraphQL connection successful')
      return true
    }
    
    // Try REST endpoint
    const restResponse = await fetch('https://www.upwork.com/api/auth/v1/info.json', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    })
    
    if (restResponse.ok) {
      console.log('✅ REST connection successful')
      return true
    }
    
    console.error('❌ Both endpoints failed')
    return false
    
  } catch (error: any) {
    console.error('❌ Connection test error:', error.message)
    return false
  }
}

// 📤 Send proposal to Upwork
async function sendProposalToUpwork(accessToken: string, jobId: string, proposal: string, bidAmount?: number) {
  try {
    console.log('🚀 Sending proposal to Upwork...')
    console.log('Job ID:', jobId)
    console.log('Proposal length:', proposal.length)
    
    // Get tenant ID from token
    const tenantId = getTenantIdFromToken(accessToken)
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    }
    
    if (tenantId) {
      headers['X-Upwork-Tenant-Id'] = tenantId
    }
    
    // Note: Upwork's exact proposal submission endpoint might vary
    // This is the typical endpoint based on documentation
    const endpoint = `https://www.upwork.com/api/profiles/v3/proposals/jobs/${jobId}/apply`
    
    const requestBody = {
      cover_letter: proposal.substring(0, 4000), // Upwork has character limits
      bid_amount: bidAmount || null,
      estimated_time: null,
      attachments: [],
      terms_and_conditions_accepted: true
    }
    
    console.log('📤 Sending to endpoint:', endpoint)
    console.log('📄 Request body:', JSON.stringify(requestBody).substring(0, 200) + '...')
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Upwork API error response:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText.substring(0, 500)
      })
      
      // Check for specific errors
      if (response.status === 403) {
        throw new Error('Permission denied. Please check your Upwork account permissions.')
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.')
      } else if (response.status === 400) {
        throw new Error('Invalid request. Please check job ID and proposal content.')
      }
      
      throw new Error(`Upwork API error: ${response.status} ${response.statusText}`)
    }
    
    const result = await response.json()
    console.log('✅ Upwork proposal sent successfully:', {
      proposal_id: result.proposal_id || result.id,
      status: result.status
    })
    
    return {
      success: true,
      proposal_id: result.proposal_id || result.id,
      status: result.status || 'submitted',
      message: 'Proposal successfully submitted to Upwork'
    }
    
  } catch (error: any) {
    console.error('❌ Failed to send proposal to Upwork:', error.message)
    throw new Error(`Failed to send to Upwork: ${error.message}`)
  }
}

// ============================
// API ENDPOINTS
// ============================

// 🔗 GET: Generate OAuth URL and check connection status
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    // 🟢 Check if user has connected Upwork account
    const upworkResult = await pool.query(
      'SELECT id, access_token, created_at FROM upwork_accounts WHERE user_id = $1',
      [user.id]
    )
    
    const hasConnection = upworkResult.rows.length > 0
    
    // 🔍 If checking connection status
    if (action === 'status') {
      if (!hasConnection) {
        return NextResponse.json({ 
          success: true,
          connected: false,
          message: 'Upwork account not connected'
        })
      }
      
      // Test the connection
      const accessToken = upworkResult.rows[0].access_token
      const isActive = await testUpworkConnection(accessToken)
      
      return NextResponse.json({
        success: true,
        connected: isActive,
        message: isActive ? 'Upwork account is connected and active' : 'Connection test failed',
        connectionDate: upworkResult.rows[0].created_at
      })
    }
    
    // 🔗 Generate OAuth URL for connection
    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI || 'https://updash.shameelnasir.com/api/upwork/callback'
    
    if (!clientId) {
      return NextResponse.json({ 
        success: false,
        error: 'Upwork client ID not configured'
      }, { status: 500 })
    }
    
    // Scopes needed for our application
    const scopes = [
      'r_compact',           // Read basic profile info
      'r_jobs',              // Read job postings
      'r_workdiary',         // Read work diary
      'w_proposals',         // Write proposals (submit applications)
      'r_contracts',         // Read contract info
      'r_messages',          // Read messages
      'r_workroom'           // Read workroom
    ].join(' ')
    
    // Generate state for security
    const state = Buffer.from(`${user.id}:${Date.now()}`).toString('base64')
    
    // Build OAuth URL
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('scope', scopes)
    authUrl.searchParams.append('state', state)
    
    console.log('🔗 Generated OAuth URL for user:', user.id)
    
    return NextResponse.json({
      success: true,
      url: authUrl.toString(),
      state: state,
      hasExistingConnection: hasConnection,
      message: 'OAuth URL generated successfully'
    })
    
  } catch (error: any) {
    console.error('❌ Upwork GET error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + error.message
    }, { status: 500 })
  }
}

// 📝 POST: Handle various Upwork actions
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const body = await request.json()
    const { action, proposalId, jobId, proposalText, bidAmount } = body

    // 🚫 DISCONNECT UPWORK ACCOUNT
    if (action === 'disconnect') {
      console.log('🚫 Disconnecting Upwork account for user:', user.id)
      
      await pool.query(
        'DELETE FROM upwork_accounts WHERE user_id = $1',
        [user.id]
      )
      
      // Also clear any related data
      await pool.query(
        'UPDATE proposals SET upwork_proposal_id = NULL WHERE user_id = $1',
        [user.id]
      )
      
      console.log('✅ Upwork account disconnected successfully')
      
      return NextResponse.json({
        success: true,
        message: 'Upwork account disconnected successfully. You can reconnect anytime.'
      })
    }
    
    // 🚀 SEND PROPOSAL TO UPWORK
    if (action === 'send-proposal') {
      if (!proposalId || !jobId || !proposalText) {
        return NextResponse.json({ 
          error: 'Proposal ID, Job ID, and proposal text are required' 
        }, { status: 400 })
      }
      
      // Check if user has Upwork connected
      const upworkResult = await pool.query(
        'SELECT access_token FROM upwork_accounts WHERE user_id = $1',
        [user.id]
      )
      
      if (upworkResult.rows.length === 0) {
        return NextResponse.json({ 
          success: false,
          error: 'Please connect your Upwork account first'
        }, { status: 400 })
      }
      
      const accessToken = upworkResult.rows[0].access_token
      
      try {
        // Send proposal to Upwork
        const upworkResponse = await sendProposalToUpwork(
          accessToken, 
          jobId, 
          proposalText, 
          bidAmount
        )
        
        // Update proposal in database
        await pool.query(
          `UPDATE proposals 
           SET upwork_proposal_id = $1, 
               status = 'sent', 
               sent_at = NOW(),
               upwork_response = $2
           WHERE id = $3 AND user_id = $4`,
          [
            upworkResponse.proposal_id,
            JSON.stringify(upworkResponse),
            proposalId,
            user.id
          ]
        )
        
        console.log('✅ Proposal sent and saved to database')
        
        return NextResponse.json({
          success: true,
          message: 'Proposal sent to Upwork successfully',
          upwork_response: upworkResponse,
          proposal_id: proposalId
        })
        
      } catch (error: any) {
        console.error('❌ Failed to send proposal:', error)
        
        // Mark as failed in database
        await pool.query(
          `UPDATE proposals 
           SET status = 'failed', 
               error_message = $1,
               updated_at = NOW()
           WHERE id = $2 AND user_id = $3`,
          [error.message, proposalId, user.id]
        )
        
        return NextResponse.json({
          success: false,
          error: error.message,
          message: 'Failed to send proposal to Upwork'
        }, { status: 500 })
      }
    }
    
    // 🔄 REFRESH TOKEN (if needed in future)
    if (action === 'refresh-token') {
      const upworkResult = await pool.query(
        'SELECT refresh_token FROM upwork_accounts WHERE user_id = $1',
        [user.id]
      )
      
      if (upworkResult.rows.length === 0 || !upworkResult.rows[0].refresh_token) {
        return NextResponse.json({
          success: false,
          error: 'No refresh token available. Please reconnect Upwork.'
        }, { status: 400 })
      }
      
      const refreshToken = upworkResult.rows[0].refresh_token
      const clientId = process.env.UPWORK_CLIENT_ID
      const clientSecret = process.env.UPWORK_CLIENT_SECRET
      
      if (!clientId || !clientSecret) {
        return NextResponse.json({
          success: false,
          error: 'Server configuration missing'
        }, { status: 500 })
      }
      
      // Refresh the token
      const tokenResponse = await fetch('https://www.upwork.com/api/v3/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: clientId,
          client_secret: clientSecret
        })
      })
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        throw new Error(`Token refresh failed: ${errorText}`)
      }
      
      const tokenData = await tokenResponse.json()
      
      // Update tokens in database
      await pool.query(
        `UPDATE upwork_accounts 
         SET access_token = $1, 
             refresh_token = $2,
             updated_at = NOW()
         WHERE user_id = $3`,
        [tokenData.access_token, tokenData.refresh_token || refreshToken, user.id]
      )
      
      console.log('✅ Token refreshed for user:', user.id)
      
      return NextResponse.json({
        success: true,
        message: 'Token refreshed successfully',
        expires_in: tokenData.expires_in
      })
    }
    
    // ❌ Invalid action
    return NextResponse.json({
      success: false,
      error: 'Invalid action'
    }, { status: 400 })
    
  } catch (error: any) {
    console.error('❌ Upwork POST error:', error)
    return NextResponse.json({
      success: false,
      error: 'Internal server error: ' + error.message
    }, { status: 500 })
  }
}

// 🗑️ DELETE: Remove Upwork connection (alternative to POST disconnect)
export async function DELETE() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    
    console.log('🗑️ Deleting Upwork connection for user:', user.id)
    
    const result = await pool.query(
      'DELETE FROM upwork_accounts WHERE user_id = $1 RETURNING id',
      [user.id]
    )
    
    if (result.rowCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'No Upwork connection found'
      }, { status: 404 })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Upwork account disconnected successfully'
    })
    
  } catch (error: any) {
    console.error('❌ DELETE error:', error)
    return NextResponse.json({
      success: false,
      error: 'Failed to disconnect: ' + error.message
    }, { status: 500 })
  }
}