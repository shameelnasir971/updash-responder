// app/api/upwork/auth/route.ts - FINAL WORKING VERSION
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

    // ✅ APPROVED SCOPE - Jaise screenshot main approve hua hai
    const scopes = "r_basic"  // ✅ YEH WAHI SCOPE HAI JO APPROVE HUA HAI
    
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri || '')
    authUrl.searchParams.append('scope', scopes)
    authUrl.searchParams.append('state', Buffer.from(user.id.toString()).toString('base64'))
    
    console.log('🔗 Final OAuth URL:', authUrl.toString())
    
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