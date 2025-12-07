// app/api/upwork/auth/route.ts - FINAL WORKING VERSION
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
    
    // ✅ BASICS: Sirf client_id, response_type, aur redirect_uri use karo
    // ✅ SCOPE PARAMETER BILKUL MAT BHEJO - Upwork apne aap configured scopes use karega
    const authUrl = `https://www.upwork.com/ab/account-security/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`
    
    console.log('✅ Simple OAuth URL generated (NO scope parameter):', authUrl)
    
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