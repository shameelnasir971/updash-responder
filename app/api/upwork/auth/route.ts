// app/api/upwork/auth/route.ts - FINAL FIXED VERSION
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

    // ✅ SOLUTION: SCOPE PARAMETER HATA DO - Upwork auto-detect karega approved scopes
    // Koi bhi scope parameter mat bhejo
    const authUrl = new URL('https://www.upwork.com/ab/account-security/oauth2/authorize')
    authUrl.searchParams.append('client_id', clientId)
    authUrl.searchParams.append('response_type', 'code')
    authUrl.searchParams.append('redirect_uri', redirectUri || '')
    
    // ✅ SCOPE PARAMETER COMPLETELY REMOVE - This is the fix!
    // authUrl.searchParams.append('scope', 'r_basic') // ❌ YEH MAT KARO
    
    console.log('✅ Generated OAuth URL WITHOUT scope parameter')
    
    return NextResponse.json({ 
      success: true,
      url: authUrl.toString(),
      message: 'Upwork OAuth URL generated (scope auto-detected)'
    })
  } catch (error: any) {
    console.error('OAuth error:', error)
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 })
  }
}