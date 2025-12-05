// app/api/upwork/auth/route.ts - UPDATED & WORKING VERSION
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
    const redirectUri = process.env.UPWORK_REDIRECT_URI // Ensure this is EXACTLY as registered
    
    if (!clientId || !redirectUri) {
      return NextResponse.json({ 
        success: false,
        error: 'Upwork API configuration missing.' 
      }, { status: 500 })
    }

    // ✅ USE THE CORRECT AUTHORIZATION ENDPOINT
    const authUrl = new URL('https://www.upwork.com/api/auth/v1/oauth2/authorize')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri)
    // 🔴 DO NOT INCLUDE 'scope' PARAMETER

    console.log('🔗 Generated OAuth URL (No Scope):', authUrl.toString())
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
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