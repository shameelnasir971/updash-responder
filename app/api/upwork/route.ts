// app/api/upwork/route.ts

import { NextResponse } from "next/server"

// app/api/upwork/auth/route.ts - ADD THIS LINE
export async function GET() {
  try {
    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI
    
    if (!clientId || !redirectUri) {
      return NextResponse.json({
        success: false,
        url: null,
        error: 'Configuration missing'
      })
    }
    
    // ✅ IMPORTANT: Add required scopes
    const scopes = [
      'r_compact',
      'r_jobs',
      'r_workdiary',
      'r_reports'
    ].join(' ')
    
    // ✅ Updated OAuth URL with scopes
    const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopes)}`
    
    console.log('🔗 Generated OAuth URL with scopes:', scopes)
    
    return NextResponse.json({
      success: true,
      url: authUrl,
      message: 'URL generated with job reading permissions'
    })
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      url: null,
      error: error.message
    })
  }
}