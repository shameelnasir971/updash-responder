// app/api/upwork/auth/route.ts - COMPLETE FIXED VERSION
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'Please login first' 
      }, { status: 401 })
    }

    console.log('🎯 Generating Upwork OAuth URL for user:', user.email)

    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI
    const scopes = 'r_basic r_work r_proposals r_jobs_browse'

    if (!clientId || !redirectUri) {
      console.error('❌ Missing Upwork credentials in .env')
      return NextResponse.json({ 
        success: false,
        error: 'Upwork API not configured. Please check environment variables.' 
      }, { status: 500 })
    }

    // ✅ FIXED: Simple Upwork OAuth URL - NO SPECIAL ENCODING
    const state = `user_${user.id}_${Date.now()}`
    
    const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${state}`

    console.log('🔗 Generated URL (first 200 chars):', authUrl.substring(0, 200))
    
    return NextResponse.json({ 
      success: true,
      url: authUrl,
      state: state,
      message: 'Upwork OAuth URL generated successfully'
    })
  } catch (error: any) {
    console.error('❌ OAuth URL generation error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Internal server error: ' + error.message 
    }, { status: 500 })
  }
}