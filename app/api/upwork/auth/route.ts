

// app/api/upwork/auth/route.ts - COMPLETELY UPDATED
import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '../../../../lib/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    console.log('🔗 Upwork OAuth request initiated')
    
    const user = await getCurrentUser()
    if (!user) {
      console.error('❌ User not authenticated')
      return NextResponse.json({ 
        success: false, 
        error: 'Please login first' 
      }, { status: 401 })
    }

    const clientId = process.env.UPWORK_CLIENT_ID
    const redirectUri = process.env.UPWORK_REDIRECT_URI
    const scopes = process.env.UPWORK_SCOPES
    
    if (!clientId || !redirectUri) {
      console.error('❌ Upwork credentials missing')
      return NextResponse.json({ 
        success: false, 
        error: 'Upwork API not configured' 
      }, { status: 500 })
    }

    console.log(`👤 User: ${user.email}, ID: ${user.id}`)
    console.log(`🔧 Client ID: ${clientId?.substring(0, 10)}...`)
    console.log(`🌐 Redirect URI: ${redirectUri}`)
    console.log(`📋 Scopes: ${scopes}`)

    // ✅ CORRECT UPWORK OAUTH 2.0 URL
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('scope', scopes || 'r_basic r_work r_proposals r_jobs_browse')
    
    // ✅ SECURE STATE PARAMETER
    const state = JSON.stringify({
      userId: user.id,
      timestamp: Date.now(),
      random: Math.random().toString(36).substring(7)
    })
    
    const encodedState = Buffer.from(state).toString('base64')
    authUrl.searchParams.set('state', encodedState)
    
    console.log('✅ OAuth URL generated successfully')
    console.log(`🔗 URL: ${authUrl.toString().substring(0, 100)}...`)

    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      message: 'Upwork authorization URL generated'
    })

  } catch (error: any) {
    console.error('❌ OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: 'Failed to generate OAuth URL: ' + error.message 
    }, { status: 500 })
  }
}