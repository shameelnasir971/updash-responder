// app/api/upwork/auth/route.ts - UPDATED WITH CORRECT SCOPE
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
    const redirectUri = process.env.UPWORK_REDIRECT_URI
    
    if (!clientId) {
      return NextResponse.json({ 
        success: false,
        error: 'UPWORK_CLIENT_ID missing' 
      }, { status: 500 })
    }

    // ✅ CORRECT: SIRF JOBS READ KI PERMISSION
    const scope = 'r_jobs'  // YEH HI CHAHIYE!
    
    // ✅ CORRECT: Upwork OAuth URL with minimal scope
    const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri || '')}&scope=${scope}`
    
    console.log('🔗 Simple OAuth URL with jobs scope:', authUrl)
    
    return NextResponse.json({ 
      success: true,
      url: authUrl,
      scope: scope,
      message: 'Upwork OAuth URL generated for jobs access only'
    })
  } catch (error: any) {
    console.error('OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}