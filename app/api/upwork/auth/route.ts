///api/upwork/auth/route.ts

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
    
    // ✅ CORRECT OAUTH URL WITH ALL REQUIRED SCOPES
    const scopes = [
      'r_jobs',           // Read jobs (MOST IMPORTANT)
      'r_marketplace',    // Read marketplace
      'r_workdiary',      // Read work diary
      'r_workfeed',       // Read work feed
      'r_myprofile'       // Read profile
    ].join(' ')
    
    const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri || '')}&scope=${encodeURIComponent(scopes)}`
    
    console.log('🔗 OAuth URL with scopes:', authUrl)
    
    return NextResponse.json({ 
      success: true,
      url: authUrl,
      message: 'Upwork OAuth URL generated with job permissions'
    })
  } catch (error: any) {
    console.error('OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}