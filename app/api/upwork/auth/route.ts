import { NextResponse } from "next/server"

// app/api/upwork/auth/route.ts
export async function GET() {
  try {
    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI
    
    if (!clientId || !redirectUri) {
      return NextResponse.json({
        success: false,
        url: null,
        error: 'UPWORK_CLIENT_ID or UPWORK_REDIRECT_URI is missing in environment variables.'
      })
    }
    
    // ✅ CRITICAL: Add the REQUIRED scope for job search
    const requiredScopes = [
      'search:jobs',       // For searching and listing jobs
      'read:jobs',         // For reading job details (if separate)
    ].join(' ')
    
    // ✅ Build the OAuth URL with the required scope
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    const params = new URLSearchParams({
      'response_type': 'code',
      'client_id': clientId,
      'redirect_uri': redirectUri,
      'scope': requiredScopes, // This is what you were missing!
      'state': 'upwork_' + Date.now() // Optional but recommended for security
    })
    
    authUrl.search = params.toString()
    
    console.log('🔗 Generated OAuth URL with scopes:', requiredScopes)
    
    return NextResponse.json({
      success: true,
      url: authUrl.toString(),
      message: 'OAuth URL generated with job search scope'
    })
    
  } catch (error: any) {
    console.error('OAuth URL generation error:', error)
    return NextResponse.json({
      success: false,
      url: null,
      error: error.message
    })
  }
}