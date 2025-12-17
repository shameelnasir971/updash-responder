import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../lib/auth'
import pool from '../../../lib/database'
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Generate OAuth URL with ALL required scopes
    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI
    
    if (!clientId || !redirectUri) {
      return NextResponse.json({ 
        error: 'Upwork API not configured properly.'
      }, { status: 500 })
    }

    // ✅ ALL NECESSARY SCOPES for full access
    const scopes = [
      'r_myprofile',          // Talent Profile - Read And Write Access
      'r_workhistory',        // Talent Workhistory - Read Only Access
      'r_jobs',               // Job Postings - Read-Only Access
      'rw_jobs',              // Management Job Postings (client side)
      'r_contracts',          // Common Entities - Read-Only Access
      'rw_proposals',         // Client Proposals - Read And Write Access
      'r_messages',           // Common Functionality - Read And Write Access
      'r_viewuserdetails',    // View UserDetails
      'r_marketplace_search'  // Read marketplace Job Postings (MOST IMPORTANT)
    ].join(' ')

    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scopes)
    
    // Random state for security
    const state = Buffer.from(`${Date.now()}_${Math.random()}`).toString('base64')
    authUrl.searchParams.set('state', state)

    console.log('🔗 Upwork OAuth URL generated with full scopes')
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      message: 'Upwork OAuth URL generated successfully'
    })
    
  } catch (error) {
    console.error('Upwork API error:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

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
      
      // Clear cache
      try {
        await fetch(`${process.env.NEXTAUTH_URL}/api/upwork/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (e) {
        // Ignore cache clear errors
      }
      
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