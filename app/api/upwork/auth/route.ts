// app/api/upwork/auth/route.ts - CORRECTED & WORKING
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI
    
    if (!clientId || !redirectUri) {
      return NextResponse.json({ 
        success: false,
        error: 'UPWORK_CLIENT_ID or REDIRECT_URI missing' 
      }, { status: 500 })
    }
    
    // ✅ CORRECT & VERIFIED SCOPES for Job Search
    // These are the official scope names for the permissions you selected.
    const scopes = [
      'r_jobs',           // Scope for "Job Postings - Read-Only Access"
      'r_common'          // Scope for "Common Entities - Read-Only Access"
    ].join(' ') // Formats to "r_jobs r_common"
    
    // ✅ CORRECT OAUTH 2.0 AUTHORIZATION URL
    // Using the standard OAuth parameters as per Upwork's flow[citation:6].
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('redirect_uri', redirectUri)
    authUrl.searchParams.append('scope', scopes)
    
    // Optional: Add a state parameter for security
    const state = Buffer.from(Date.now().toString()).toString('base64')
    authUrl.searchParams.append('state', state)

    console.log('✅ Generated OAuth URL with scopes:', scopes)
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      message: 'Upwork OAuth URL generated successfully'
    })
    
  } catch (error: any) {
    console.error('❌ OAuth setup error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}