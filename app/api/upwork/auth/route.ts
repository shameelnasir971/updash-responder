// app/api/upwork/auth/route.ts - COMPLETE NEW VERSION
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
    const scopes = process.env.UPWORK_SCOPES || 'r_basic r_work r_proposals r_jobs_browse'
    
    if (!clientId) {
      return NextResponse.json({ 
        success: false,
        error: 'UPWORK_CLIENT_ID missing' 
      }, { status: 500 })
    }

    // ✅ FIXED: SIMPLE OAuth URL (NO COMPLEX REDIRECT)
    const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?client_id=${clientId}&response_type=code&scope=${encodeURIComponent(scopes)}`
    
    console.log('🎯 Upwork OAuth URL generated for user:', user.email)
    
    return NextResponse.json({ 
      success: true,
      url: authUrl,
      message: 'Upwork OAuth URL generated'
    })
  } catch (error: any) {
    console.error('❌ OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error' 
    }, { status: 500 })
  }
}