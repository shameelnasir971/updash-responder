//app/api/upwork/auth/route.ts

// app/api/upwork/auth/route.ts - CORRECT VERSION

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
    
    if (!clientId) {
      return NextResponse.json({ 
        success: false,
        error: 'UPWORK_CLIENT_ID missing' 
      }, { status: 500 })
    }
    
    // ✅ TRY ONLY THESE SCOPES (Your approved permissions)
    // 1. 'r_jobs' - For "Read marketplace Job Postings"
    // 2. 'r_basic' - For basic info
    const scopes = encodeURIComponent('r_jobs r_basic')
    
    // ✅ Build OAuth URL
    const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri || '')}&scope=${scopes}`
    
    console.log('🔗 OAuth URL with approved scopes:', authUrl)
    
    return NextResponse.json({ 
      success: true,
      url: authUrl,
      message: 'Upwork OAuth URL generated'
    })
  } catch (error: any) {
    console.error('OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}