// app/api/upwork/auth/route.ts - UPDATED WITH EXACT SCOPE
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    // ✅ EXACT SAME URL JO UPWORK MAIN HAI
    const redirectUri = process.env.UPWORK_REDIRECT_URI || 'https://updash.shameelnasir.com/api/upwork/callback'
    
    if (!clientId) {
      return NextResponse.json({ 
        success: false,
        error: 'UPWORK_CLIENT_ID missing' 
      }, { status: 500 })
    }

    // UPWORK OAuth URL
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    
    // ✅ AAPKE UPWORK API KEY KE LIYE APPROVED SCOPE:
    // Aapki screenshot main "read-only access to job postings" likha hai
    // Iska matlab sirf `r_jobs` scope approved hai
    authUrl.searchParams.set('scope', 'r_jobs')  // ✅ SIRF r_jobs
    
    // Add state to identify user
    const state = `user_${user.id}_${Date.now()}`
    authUrl.searchParams.set('state', state)

    console.log('🔗 Upwork OAuth URL generated:')
    console.log('- Client ID:', clientId)
    console.log('- Redirect URI:', redirectUri)
    console.log('- Scope: r_jobs (read-only jobs)')
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      message: 'Upwork OAuth URL generated successfully'
    })
  } catch (error) {
    console.error('❌ OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 })
  }
}