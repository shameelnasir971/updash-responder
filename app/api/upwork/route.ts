import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    // Test with different scopes
    const scopes = [
      '',  // Empty scope
      'r_basic', 
      'r_work', 
      'r_jobs',
      'r_basic r_jobs',
      'r_basic r_work',
      'r_jobs r_work'
    ]

    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI

    const testResults = scopes.map(scope => {
      const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
      authUrl.searchParams.set('client_id', clientId || '')
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('redirect_uri', redirectUri || '')
      
      if (scope) {
        authUrl.searchParams.set('scope', scope)
      }
      
      return {
        scope: scope || '(empty)',
        url: authUrl.toString().replace(clientId || '', '***HIDDEN***')
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Test scopes for Upwork OAuth',
      clientId: clientId ? '***SET***' : 'MISSING',
      redirectUri: redirectUri || 'MISSING',
      testUrls: testResults
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}